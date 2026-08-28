3DX WORLD LIBRARY — ADMIN MANAGER
=================================

You do NOT make a new HTML page for each world.
Everything is managed from one section in /admin.html.

ADD A NEW WORLD
---------------
1. Sign in to Mayflower Studios with an owner/admin account.
2. Open /admin.html.
3. Find “3DX world library”.
4. Click “+ New world”.
5. Enter the world name, creator, description, tags, and optional version note.
6. Choose the .world file (maximum 250 MB).
7. Add up to 20 screenshots (JPG, PNG, WEBP, or GIF; maximum 15 MB each).
8. Reorder screenshots by dragging them or using the arrow buttons.
9. Use the star/Cover button to make any screenshot the first image / cover.
10. Leave “Visible in the public library” on, or turn it off to save the world hidden.
11. Click “Publish world” / save.

The same /worlds.html page automatically displays every public world.

EDIT AN EXISTING WORLD
----------------------
1. Find the world in the “Your worlds” list on the right.
2. Click Edit.
3. Change the name, creator, description, tags, version, featured status, or visibility.
4. Leave the .world picker empty to keep the current file, or choose a new .world file to replace it.
5. Existing screenshots remain in the editor. Add more pictures, remove individual pictures,
   change the cover, or reorder them. You do NOT need to replace the entire gallery.
6. Click “Save changes”.

DELETE A WORLD
--------------
Click Delete beside the world in the admin list and confirm.
The public library entry is removed immediately and the manager also attempts to clean up
its uploaded Storage files.

FIREBASE
--------
FirebaseRules-full.json contains the complete Realtime Database rules including /worldLibrary.
FirebaseStorageRules-full-updated.rules contains the complete Storage rules including
world-library screenshots and .world files.

Publish BOTH rule sets in Firebase before using uploads.


PAID WORLDS
-----------
The Admin World Manager now has a Free/Paid access selector. Paid worlds use BMT Micro checkout and protected Firebase/Cloud Storage delivery. See PAID-WORLDS-SETUP.txt before publishing any paid world.
