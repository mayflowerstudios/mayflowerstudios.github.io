3DX WORLD LIBRARY — HOW TO ADD A WORLD
======================================

You do NOT make a new HTML page for each world.

1. Sign in to Mayflower Studios with an owner/admin account.
2. Open /admin.html.
3. Find “3DX world library”.
4. Enter the world name, description, tags, and optional version note.
5. Choose the .world file.
6. Choose up to 20 screenshots. The FIRST screenshot is the cover image.
7. Click “Publish world”.

The world immediately appears on /worlds.html.

To change a world:
- Click Edit in the admin list.
- Change text normally.
- Leave the .world picker empty to keep the current file.
- Leave Screenshots empty to keep the current gallery.
- Choosing new screenshots replaces the existing gallery.

To hide a world without deleting it:
- Edit it and turn off “Visible in the public library”.

FIREBASE
--------
The updated FirebaseRules-full.json contains the Realtime Database rules for /worldLibrary.
Publish those rules before using the manager.

World files and screenshots are uploaded to Firebase Storage under /world-library/.
Your Firebase Storage rules also need the two world-library match blocks in
FirebaseStorageRules-WORLD-LIBRARY.txt. Those blocks only let a signed-in user upload inside
their own UID folder, while the Realtime Database still controls who can actually publish a
visible library entry. Do NOT replace your full Storage rules with the snippet; merge the two
match blocks into the rules you already use for avatars, chat images, videos, etc.
