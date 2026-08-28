"use strict";

const {onRequest}=require("firebase-functions/v2/https");
const {onObjectFinalized}=require("firebase-functions/v2/storage");
const {defineSecret}=require("firebase-functions/params");
const {initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getDatabase}=require("firebase-admin/database");
const {getStorage}=require("firebase-admin/storage");
const {XMLParser}=require("fast-xml-parser");

initializeApp();
const db=getDatabase();
const storage=getStorage();
const BMT_USER=defineSecret("BMT_WEBHOOK_USER");
const BMT_PASS=defineSecret("BMT_WEBHOOK_PASS");
const ALLOWED_ORIGINS=new Set(["https://mayflowerstudios.net","https://www.mayflowerstudios.net"]);

function cors(req,res){
  const origin=String(req.headers.origin||"");
  if(ALLOWED_ORIGINS.has(origin))res.set("Access-Control-Allow-Origin",origin);
  res.set("Vary","Origin");
  res.set("Access-Control-Allow-Headers","Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods","GET, OPTIONS");
  res.set("Cache-Control","no-store");
}
function clean(v,max=300){return String(v==null?"":v).trim().slice(0,max)}
function list(v){return Array.isArray(v)?v:(v==null?[]:[v])}
function basicOK(req){
  const h=String(req.headers.authorization||"");
  if(!h.startsWith("Basic "))return false;
  let decoded="";try{decoded=Buffer.from(h.slice(6),"base64").toString("utf8")}catch(_){return false}
  const cut=decoded.indexOf(":");if(cut<0)return false;
  return decoded.slice(0,cut)===BMT_USER.value()&&decoded.slice(cut+1)===BMT_PASS.value();
}
function xmlOK(res){res.status(200).type("application/xml").send("<response><ordernotification/></response>")}
function xmlError(res,msg){
  const safe=clean(msg,180).replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&apos;"}[c]));
  res.status(200).type("application/xml").send(`<response><ordernotification><errorcode>1</errorcode><errormessage>${safe}</errormessage></ordernotification></response>`);
}
async function isSiteAdmin(uid){
  const u=(await db.ref(`users/${uid}/username`).get()).val();if(!u)return false;
  const name=String(u).toLowerCase();
  const [owner,admin]=await Promise.all([db.ref("owner").get(),db.ref(`admins/${name}`).get()]);
  return String(owner.val()||"").toLowerCase()===name||admin.val()===true;
}

exports.worldBmtWebhook=onRequest({region:"us-central1",secrets:[BMT_USER,BMT_PASS],timeoutSeconds:60},async(req,res)=>{
  if(req.method!=="POST")return res.status(405).send("POST only");
  if(!basicOK(req))return res.status(401).set("WWW-Authenticate",'Basic realm="Mayflower BMT"').send("Unauthorized");
  try{
    const raw=req.rawBody?req.rawBody.toString("utf8"):String(req.body||"");
    if(!raw||raw.length>1024*1024)throw new Error("Invalid XML body");
    const parser=new XMLParser({ignoreAttributes:false,trimValues:true,parseTagValue:false});
    const doc=parser.parse(raw);
    const n=doc&&doc.request&&doc.request.ordernotification;
    if(!n)throw new Error("Missing ordernotification");
    const orderId=clean(n.orderid,80), orderNumber=clean(n.ordernumber,120);
    if(!orderId)throw new Error("Missing order ID");

    // Credits/refunds identify the original order. Revoke every purchase recorded under it.
    const credited=clean(n.creditedorderid,80), creditReason=clean(n.creditreason,300);
    if(credited||creditReason){
      const original=credited||orderId;
      const snap=await db.ref(`worldOrders/${original}`).get();
      const existing=snap.val()||{};
      const updates={};
      for(const [key,o] of Object.entries(existing.items||{})){
        if(!o||!o.uid||!o.worldId)continue;
        const current=(await db.ref(`worldPurchases/${o.uid}/${o.worldId}`).get()).val();
        // Do not revoke a later repurchase just because an older order was refunded.
        if(!current||String(current.orderId||"")!==String(original))continue;
        updates[`worldPurchases/${o.uid}/${o.worldId}/status`]="revoked";
        updates[`worldPurchases/${o.uid}/${o.worldId}/revokedAt`]=Date.now();
        updates[`worldPurchases/${o.uid}/${o.worldId}/revokeReason`]=creditReason||"BMT order credited";
      }
      updates[`worldOrders/${original}/status`]="credited";
      updates[`worldOrders/${original}/creditedAt`]=Date.now();
      updates[`worldOrders/${original}/creditReason`]=creditReason||"BMT order credited";
      await db.ref().update(updates);
      return xmlOK(res);
    }

    const priorStatus=(await db.ref(`worldOrders/${orderId}/status`).get()).val();
    if(priorStatus==="credited")return xmlOK(res);

    const uid=clean(n.orderparameters,128);
    if(!/^[A-Za-z0-9_-]{6,128}$/.test(uid))throw new Error("Missing or invalid Mayflower user ID in ORDERPARAMETERS");
    // Confirm the Firebase account still exists before granting anything.
    await getAuth().getUser(uid);

    const items=list(n.orderitem);
    if(!items.length)throw new Error("No order items");
    const updates={};let accepted=0;
    for(let i=0;i<items.length;i++){
      const item=items[i]||{};
      const worldId=clean(item.iteminfo,80);
      const productId=clean(item.productid,40);
      if(!worldId||!productId)continue;
      const world=(await db.ref(`worldLibrary/${worldId}`).get()).val();
      if(!world||world.published!==true||!world.commerce||world.commerce.type!=="paid")continue;
      if(String(world.commerce.bmtProductId||"")!==productId)continue;
      const now=Date.now();
      updates[`worldPurchases/${uid}/${worldId}`]={
        status:"active",worldId,productId,orderId,orderNumber,
        purchasedAt:now,quantity:Number(item.quantity)||1,
        productPrice:clean(item.productprice,40),productCurrency:clean(item.productcurrency,8),
        itemEmail:clean(item.itememail,200)
      };
      updates[`worldOrders/${orderId}/items/${i}`]={uid,worldId,productId};
      accepted++;
    }
    if(!accepted)throw new Error("No Mayflower paid-world product matched this order");
    updates[`worldOrders/${orderId}/status`]="paid";
    updates[`worldOrders/${orderId}/orderId`]=orderId;
    updates[`worldOrders/${orderId}/orderNumber`]=orderNumber;
    updates[`worldOrders/${orderId}/uid`]=uid;
    updates[`worldOrders/${orderId}/recordedAt`]=Date.now();
    await db.ref().update(updates);
    xmlOK(res);
  }catch(err){console.error("BMT webhook",err);xmlError(res,err.message||"Temporary processing error")}
});

exports.worldDownload=onRequest({region:"us-central1",timeoutSeconds:30},async(req,res)=>{
  cors(req,res);if(req.method==="OPTIONS")return res.status(204).send("");
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  try{
    const authHeader=String(req.headers.authorization||"");
    if(!authHeader.startsWith("Bearer "))return res.status(401).json({error:"Sign in to download this world."});
    const decoded=await getAuth().verifyIdToken(authHeader.slice(7));
    const uid=decoded.uid;
    const worldId=clean(req.query.world,80);
    if(!/^[a-z0-9-]{1,80}$/.test(worldId))return res.status(400).json({error:"Invalid world."});
    const [worldSnap,purchaseSnap,privateSnap]=await Promise.all([
      db.ref(`worldLibrary/${worldId}`).get(),db.ref(`worldPurchases/${uid}/${worldId}`).get(),db.ref(`worldPrivate/${worldId}`).get()
    ]);
    const world=worldSnap.val(),purchase=purchaseSnap.val(),priv=privateSnap.val();
    if(!world||world.published!==true||!world.commerce||world.commerce.type!=="paid")return res.status(404).json({error:"Paid world not found."});
    const admin=await isSiteAdmin(uid);
    if(!admin&&(!purchase||purchase.status!=="active"))return res.status(403).json({error:"This account has not purchased this world, or the purchase was refunded."});
    if(!priv||!priv.path||!String(priv.path).startsWith("world-library-private/"))return res.status(503).json({error:"Protected file is not configured."});
    const file=storage.bucket().file(priv.path);
    const [exists]=await file.exists();if(!exists)return res.status(404).json({error:"Protected file is missing."});
    const safeName=String(priv.name||world.world&&world.world.name||"world.world").replace(/[\\\"\r\n]/g,"-");
    const [url]=await file.getSignedUrl({version:"v4",action:"read",expires:Date.now()+5*60*1000,responseDisposition:`attachment; filename="${safeName}"`});
    res.json({url,expiresInSeconds:300});
  }catch(err){console.error("worldDownload",err);res.status(500).json({error:"Could not create the secure download link."})}
});

// Firebase download-token URLs can bypass Storage Rules if the token is known.
// Private paid-world objects never publish such a token, and this trigger also blanks any
// Firebase download token metadata after upload as an extra layer of protection.
exports.stripPaidWorldDownloadToken=onObjectFinalized({region:"us-central1"},async event=>{
  const o=event.data;if(!o||!o.name||!o.name.startsWith("world-library-private/"))return;
  const file=storage.bucket(o.bucket).file(o.name);
  const [m]=await file.getMetadata();
  const custom=Object.assign({},m.metadata||{});
  if(custom.firebaseStorageDownloadTokens){custom.firebaseStorageDownloadTokens="";await file.setMetadata({cacheControl:"private, no-store",metadata:custom})}
  else if(m.cacheControl!=="private, no-store")await file.setMetadata({cacheControl:"private, no-store"});
});
