Mayflower Idle RPG Firebase leaderboard setup
============================================

The app submits public gameplay stats to:
leaderboards/mayflowerIdleRPG/entries/{installId}

The website reads the same path and displays live boards on mayflower-idle-rpg.html.

How to enable it:
1. Open Firebase Console.
2. Go to Realtime Database > Rules.
3. Merge the leaderboards/mayflowerIdleRPG section from firebase-rules-mayflower-idle-rpg.json into your existing rules.
4. Publish the rules.
5. Upload the updated website files.
6. Run the app, let it save once, then refresh the Mayflower Idle RPG page.

Important:
- The client app cannot safely hide an admin secret, so these rules allow public writes only to a narrow, validated leaderboard shape.
- This is good enough for a cozy V1 public board, but it is not cheat-proof.
- A stricter V2 would use Cloudflare Workers or Firebase Cloud Functions to verify submissions server-side.

Uploaded fields are gameplay-only. The app does not upload save files, emails, private journal text, crash logs, or local paths.
