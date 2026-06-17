# Together — unified room system

The Watch Together, Together (games), and Date Night features are now **one
system** built around your account and friends list. There's a single hub,
one create flow, and one room registry. You open a room, pick its **type** and
**who can join**, and (for private rooms) invite friends.

## What changed

### New files
- **`rooms.js`** — `window.MFRooms`, the unified room registry. Owns the
  `rooms/{id}` and `roomInvites/{uid}` trees and all access logic. Loaded on
  every page by `shared.js` (right after `auth.js`).
- **`firebase-rules.json`** — complete Realtime Database security rules. **You
  must publish these** (see below).

### Rebuilt
- **`together.html`** — the hub. One create flow (type → visibility → name →
  invite friends), a live room browser filtered to what you're allowed to see,
  type filters, join-by-link, a pending-invites inbox, and an owner "manage
  room" dialog (change visibility, add/remove invites, close room).
- **`watch.html`** — now a thin redirect into the hub (old links still work).

### Gated (now enforce access before connecting)
- **`watch-together.html`**, **`together-room.html`**, **`date-night.js`** —
  each checks `MFRooms.canEnter()` first, routes you to the correct page if the
  room is a different type, and bounces back to the hub with a friendly reason
  if you're not allowed in. Legacy/ad-hoc room names still work as a fallback.

### Touched
- `auth.js` — exposes `MFAuth._dbmod` so `rooms.js` reuses the one DB
  connection.
- `shared.js` — loads `rooms.js`; asset version bumped to **29**.
- `index.html`, `404.html`, `sitemap.xml` — links/wording updated to the hub.

## Room model

```
rooms/{id} = {
  id, type:'watch'|'games'|'date', vis:'public'|'friends'|'private',
  name, owner, ownerName, ownerUsername, t, lastActive,
  invites: { uid: { t } },   // private rooms
  members: { uid: t }
}
roomInvites/{uid}/{roomId} = { id, type, name, fromName, fromUid, t }
```

The id is a stable random code (not the name), so two rooms can share a label.
The per-type live state still lives under `watch/{id}`, `together/{id}`, and
`datenight/{id}` — keyed by that same id.

### Who can see / join
- **public** — listed for everyone; anyone can drop in.
- **friends only** — listed only to the owner's friends; friends join freely.
- **private** — hidden; only the owner and explicitly invited friends get in.

## One required step: publish the security rules

Open **Firebase Console → Realtime Database → Rules**, paste the contents of
`firebase-rules.json`, and **Publish**. Until you do, creating rooms will fail
with a permission error.

A note on the listing read: the room *metadata* tree (`rooms`) is readable by
signed-in users so the hub can build your list. The rules can't friend-check a
whole-list read, so a determined reader could in principle discover a
friends-only/private room's *name* — but the actual experience (video sync,
chat, drawings, notes) and entry are gated by `canEnter()` and the per-type
rules, so they can't get *in*. If you ever want hard secrecy of names too, the
next step would be Cloud Functions writing a per-user `visibleRooms/{uid}`
index; the client code is already structured to swap to that.

## Deleting legacy bits later
Once no old `lobby/`-style watch rooms remain, you can drop the `lobby` block
from the rules and the legacy fallbacks in the gates.
