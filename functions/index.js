"use strict";

const {onRequest}=require("firebase-functions/v2/https");
const {onInit}=require("firebase-functions/v2/core");
const {defineSecret}=require("firebase-functions/params");
const {initializeApp}=require("firebase-admin/app");
const {getAuth}=require("firebase-admin/auth");
const {getDatabase}=require("firebase-admin/database");

// Keep deployment discovery lightweight. Firebase runs onInit() only in the
// deployed runtime, so Admin SDK initialization does not slow down CLI discovery.
let db;
onInit(()=>{
  initializeApp();
  db=getDatabase();
});
let StripeCtor;
const STRIPE_SECRET_KEY=defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET=defineSecret("STRIPE_WEBHOOK_SECRET");
const ALLOWED_ORIGINS=new Set(["https://mayflowerstudios.net","https://www.mayflowerstudios.net"]);
const SITE_ORIGIN="https://mayflowerstudios.net";

function stripeClient(){
  // Stripe is fairly large; lazy-load it on the first real request instead of
  // making Firebase load it while merely discovering which functions exist.
  if(!StripeCtor)StripeCtor=require("stripe");
  return new StripeCtor(STRIPE_SECRET_KEY.value());
}
function cors(req,res){
  const origin=String(req.headers.origin||"");
  if(ALLOWED_ORIGINS.has(origin))res.set("Access-Control-Allow-Origin",origin);
  res.set("Vary","Origin");
  res.set("Access-Control-Allow-Headers","Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.set("Cache-Control","no-store");
}
function clean(v,max=300){return String(v==null?"":v).trim().slice(0,max)}
function validWorldId(v){return /^[a-z0-9-]{1,80}$/.test(v)}
function validUid(v){return /^[A-Za-z0-9_-]{6,128}$/.test(v)}
function validCurrency(v){return /^[A-Z]{3}$/.test(v)}
async function authUid(req){
  const h=String(req.headers.authorization||"");
  if(!h.startsWith("Bearer "))throw Object.assign(new Error("Sign in first."),{status:401});
  try{return await getAuth().verifyIdToken(h.slice(7))}
  catch(_){throw Object.assign(new Error("Your sign-in session is invalid or expired."),{status:401})}
}
async function isSiteAdmin(uid){
  const u=(await db.ref(`users/${uid}/username`).get()).val();if(!u)return false;
  const name=String(u).toLowerCase();
  const [owner,admin]=await Promise.all([db.ref("owner").get(),db.ref(`admins/${name}`).get()]);
  return String(owner.val()||"").toLowerCase()===name||admin.val()===true;
}
async function grantStripePurchase(session,stripe){
  if(!session||session.mode!=="payment")return;
  if(session.payment_status!=="paid"&&session.payment_status!=="no_payment_required")return;
  const uid=clean(session.metadata&&session.metadata.uid||session.client_reference_id,128);
  const worldId=clean(session.metadata&&session.metadata.worldId,80);
  if(!validUid(uid)||!validWorldId(worldId))throw new Error("Stripe session is missing valid Mayflower purchase metadata.");
  await getAuth().getUser(uid);
  const world=(await db.ref(`worldLibrary/${worldId}`).get()).val();
  if(!world||!world.commerce||world.commerce.type!=="paid")throw new Error("Paid world no longer exists.");

  const paymentIntentId=typeof session.payment_intent==="string"?session.payment_intent:(session.payment_intent&&session.payment_intent.id)||"";
  // Webhooks can be delivered out of order. Check Stripe's current charge state before granting
  // so a late Checkout retry cannot re-unlock an already refunded or disputed payment.
  if(paymentIntentId){
    const pi=await stripe.paymentIntents.retrieve(paymentIntentId,{expand:["latest_charge"]});
    const ch=pi&&pi.latest_charge;
    if(ch&&typeof ch==="object"&&(ch.refunded===true||ch.disputed===true))return;
  }
  const priorOrderStatus=(await db.ref(`worldOrders/${session.id}/status`).get()).val();
  if(priorOrderStatus&&priorOrderStatus!=="paid")return;
  const amount=Number(session.amount_total)||0;
  const currency=clean(session.currency,8).toUpperCase();
  const now=Date.now();
  const sessionCreated=Number(session.created||0)*1000;
  const current=(await db.ref(`worldPurchases/${uid}/${worldId}`).get()).val();
  // Webhook retries are normal. Don't replace a genuinely later repurchase with an older session retry.
  if(current&&current.checkoutSessionId&&current.checkoutSessionId!==session.id&&Number(current.purchasedAt||0)>sessionCreated){
    return;
  }
  const purchase={
    status:"active",provider:"stripe",worldId,
    checkoutSessionId:clean(session.id,120),paymentIntentId:clean(paymentIntentId,120),
    amountPaidCents:amount,currency,
    purchasedAt:now,
    customerEmail:clean(session.customer_details&&session.customer_details.email||session.customer_email,240)
  };
  const order={
    provider:"stripe",status:"paid",checkoutSessionId:clean(session.id,120),
    paymentIntentId:clean(paymentIntentId,120),uid,worldId,
    amountPaidCents:amount,currency,
    customerEmail:purchase.customerEmail,recordedAt:now,
    livemode:session.livemode===true
  };
  await db.ref().update({[`worldPurchases/${uid}/${worldId}`]:purchase,[`worldOrders/${session.id}`]:order});
}
async function purchaseForCharge(charge,stripe){
  const piId=typeof charge.payment_intent==="string"?charge.payment_intent:(charge.payment_intent&&charge.payment_intent.id)||"";
  if(!piId)return null;
  const pi=await stripe.paymentIntents.retrieve(piId);
  const uid=clean(pi.metadata&&pi.metadata.uid,128),worldId=clean(pi.metadata&&pi.metadata.worldId,80);
  if(!validUid(uid)||!validWorldId(worldId))return null;
  const purchase=(await db.ref(`worldPurchases/${uid}/${worldId}`).get()).val();
  if(!purchase||String(purchase.paymentIntentId||"")!==piId)return null;
  return {uid,worldId,piId,purchase};
}
async function revokeForCharge(charge,stripe,reason,status="revoked"){
  const found=await purchaseForCharge(charge,stripe);if(!found)return;
  const {uid,worldId,piId,purchase}=found;
  const now=Date.now();
  const updates={
    [`worldPurchases/${uid}/${worldId}/status`]:status,
    [`worldPurchases/${uid}/${worldId}/revokedAt`]:now,
    [`worldPurchases/${uid}/${worldId}/revokeReason`]:clean(reason,300)
  };
  if(purchase.checkoutSessionId){
    updates[`worldOrders/${purchase.checkoutSessionId}/status`]=status;
    updates[`worldOrders/${purchase.checkoutSessionId}/updatedAt`]=now;
    updates[`worldOrders/${purchase.checkoutSessionId}/statusReason`]=clean(reason,300);
  }
  updates[`worldPurchases/${uid}/${worldId}/paymentIntentId`]=piId;
  await db.ref().update(updates);
}

// Creates Stripe Checkout from the authoritative price stored in Realtime Database.
// The browser sends only the world ID; it never supplies the amount or currency to charge.
exports.worldCheckout=onRequest({region:"us-central1",secrets:[STRIPE_SECRET_KEY],timeoutSeconds:30},async(req,res)=>{
  cors(req,res);if(req.method==="OPTIONS")return res.status(204).send("");
  if(req.method!=="POST")return res.status(405).json({error:"POST only"});
  try{
    const decoded=await authUid(req);const uid=decoded.uid;
    const worldId=clean(req.body&&req.body.worldId,80);
    if(!validWorldId(worldId))return res.status(400).json({error:"Invalid world."});
    const [worldSnap,privateSnap,purchaseSnap]=await Promise.all([
      db.ref(`worldLibrary/${worldId}`).get(),db.ref(`worldPrivate/${worldId}`).get(),db.ref(`worldPurchases/${uid}/${worldId}`).get()
    ]);
    const world=worldSnap.val(),priv=privateSnap.val(),purchase=purchaseSnap.val();
    if(!world||world.published!==true||!world.commerce||world.commerce.type!=="paid")return res.status(404).json({error:"Paid world not found."});
    if(purchase&&purchase.status==="active")return res.json({alreadyOwned:true});
    if(!priv||!priv.path||!String(priv.path).startsWith("world-library-private/"))return res.status(503).json({error:"This paid world's protected file is not configured."});
    const priceCents=Number(world.commerce.priceCents),currency=clean(world.commerce.currency,3).toUpperCase();
    if(!Number.isInteger(priceCents)||priceCents<1||priceCents>100000000||!validCurrency(currency))return res.status(503).json({error:"This world's Stripe price is not configured correctly."});

    const stripe=stripeClient();
    const session=await stripe.checkout.sessions.create({
      mode:"payment",
      client_reference_id:uid,
      customer_email:decoded.email||undefined,
      line_items:[{
        quantity:1,
        price_data:{
          currency:currency.toLowerCase(),unit_amount:priceCents,
          product_data:{name:clean(world.title,80),description:"3DXChat .world file — personal-use digital license"}
        }
      }],
      metadata:{uid,worldId},
      payment_intent_data:{metadata:{uid,worldId}},
      success_url:`${SITE_ORIGIN}/worlds.html?world=${encodeURIComponent(worldId)}&checkout=success`,
      cancel_url:`${SITE_ORIGIN}/worlds.html?world=${encodeURIComponent(worldId)}&checkout=cancelled`,
      submit_type:"pay"
    });
    if(!session.url)throw new Error("Stripe did not return a Checkout URL.");
    res.json({url:session.url});
  }catch(err){
    console.error("worldCheckout",err);
    const status=Number(err.status)||500;
    const safe=status>=500?"Could not start Stripe Checkout.":clean(err.message,200);
    res.status(status).json({error:safe});
  }
});

// Stripe is the source of truth for fulfillment. Never unlock from the success redirect alone.
exports.worldStripeWebhook=onRequest({region:"us-central1",secrets:[STRIPE_SECRET_KEY,STRIPE_WEBHOOK_SECRET],timeoutSeconds:60},async(req,res)=>{
  if(req.method!=="POST")return res.status(405).send("POST only");
  const sig=req.headers["stripe-signature"];
  if(!sig)return res.status(400).send("Missing Stripe signature");
  let event;
  try{
    const stripe=stripeClient();
    event=stripe.webhooks.constructEvent(req.rawBody,sig,STRIPE_WEBHOOK_SECRET.value());
    if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"){
      await grantStripePurchase(event.data.object,stripe);
    }else if(event.type==="charge.refunded"){
      const charge=event.data.object;
      if(charge.refunded===true||Number(charge.amount_refunded||0)>=Number(charge.amount||0)){
        await revokeForCharge(charge,stripe,"Stripe payment fully refunded","revoked");
      }else{
        const found=await purchaseForCharge(charge,stripe);
        if(found){
          const p=found.purchase,updates={
            [`worldPurchases/${found.uid}/${found.worldId}/partialRefundCents`]:Number(charge.amount_refunded)||0,
            [`worldPurchases/${found.uid}/${found.worldId}/partialRefundAt`]:Date.now()
          };
          if(p.checkoutSessionId)updates[`worldOrders/${p.checkoutSessionId}/partialRefundCents`]=Number(charge.amount_refunded)||0;
          await db.ref().update(updates);
        }
      }
    }else if(event.type==="charge.dispute.created"){
      const dispute=event.data.object;
      const chargeId=typeof dispute.charge==="string"?dispute.charge:(dispute.charge&&dispute.charge.id)||"";
      if(chargeId){const charge=await stripe.charges.retrieve(chargeId);await revokeForCharge(charge,stripe,"Stripe payment disputed","disputed")}
    }else if(event.type==="charge.dispute.closed"){
      const dispute=event.data.object;
      const chargeId=typeof dispute.charge==="string"?dispute.charge:(dispute.charge&&dispute.charge.id)||"";
      if(chargeId){
        const charge=await stripe.charges.retrieve(chargeId);const found=await purchaseForCharge(charge,stripe);
        if(found&&found.purchase.status==="disputed"){
          if(dispute.status==="won"){
            const updates={
              [`worldPurchases/${found.uid}/${found.worldId}/status`]:"active",
              [`worldPurchases/${found.uid}/${found.worldId}/disputeResolvedAt`]:Date.now(),
              [`worldPurchases/${found.uid}/${found.worldId}/revokeReason`]:null,
              [`worldPurchases/${found.uid}/${found.worldId}/revokedAt`]:null
            };
            if(found.purchase.checkoutSessionId){updates[`worldOrders/${found.purchase.checkoutSessionId}/status`]="paid";updates[`worldOrders/${found.purchase.checkoutSessionId}/statusReason`]="Stripe dispute won"}
            await db.ref().update(updates);
          }else{
            await revokeForCharge(charge,stripe,`Stripe dispute closed: ${clean(dispute.status,40)}`,"revoked");
          }
        }
      }
    }
    res.status(200).send("ok");
  }catch(err){console.error("worldStripeWebhook",err);res.status(400).send(`Webhook error: ${clean(err.message,180)}`)}
});

exports.worldDownload=onRequest({region:"us-central1",timeoutSeconds:30},async(req,res)=>{
  cors(req,res);if(req.method==="OPTIONS")return res.status(204).send("");
  if(req.method!=="GET")return res.status(405).json({error:"GET only"});
  try{
    const decoded=await authUid(req);const uid=decoded.uid;
    const worldId=clean(req.query.world,80);
    if(!validWorldId(worldId))return res.status(400).json({error:"Invalid world."});
    const [worldSnap,purchaseSnap,privateSnap]=await Promise.all([
      db.ref(`worldLibrary/${worldId}`).get(),db.ref(`worldPurchases/${uid}/${worldId}`).get(),db.ref(`worldPrivate/${worldId}`).get()
    ]);
    const world=worldSnap.val(),purchase=purchaseSnap.val(),priv=privateSnap.val();
    if(!world||!world.commerce||world.commerce.type!=="paid")return res.status(404).json({error:"Paid world not found."});
    const admin=await isSiteAdmin(uid);
    if(!admin&&(!purchase||purchase.status!=="active"))return res.status(403).json({error:"This account has not purchased this world, or the purchase was refunded/disputed."});
    if(!priv||priv.scheme!=="AES-GCM-256-v1"||!priv.url||!priv.key||!priv.iv)return res.status(503).json({error:"This paid world uses the old protected-file format. Re-upload its .world file once from Admin to convert it to the new secure format."});
    if(!String(priv.path||"").startsWith("world-library-paid/"))return res.status(503).json({error:"Protected file metadata is invalid."});
    if(!String(priv.url).startsWith("https://"))return res.status(503).json({error:"Protected file URL is invalid."});
    res.json({
      scheme:"AES-GCM-256-v1",
      url:String(priv.url),
      key:String(priv.key),
      iv:String(priv.iv),
      name:String(priv.name||world.world&&world.world.name||"world.world"),
      size:Number(priv.size)||0
    });
  }catch(err){console.error("worldDownload",err);res.status(Number(err.status)||500).json({error:Number(err.status)===401?"Sign in to download this world.":"Could not unlock this download."})}
});

