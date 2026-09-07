# The gift cupboard

Add your own images to the category folders here, then run this from the website folder:

```powershell
node tools/build-gifts.mjs
```

Publish the new images and the refreshed `catalog.json` with the website. No page code needs changing.

- **Transparent PNG or WebP** is ideal for stickers. Transparency stays intact; the site never flattens your images onto white.
- GIF, JPG, and AVIF also work. GIFs keep their animation. JPG does not support transparency.
- Use a clear, unique filename such as `sleepy-fox.png`. Its name becomes **Sleepy Fox** in the picker. Keep the display name under 33 characters.
- A top-level folder becomes a category. Create `Halloween/`, `Friendship/`, or any other category you like.
- Around 512 × 512 pixels and under 500 KB works well. Portrait and landscape gifts fit without cropping or stretching.
- Keep filenames unique across categories. Don't rename or remove images already sent as gifts: their filename is their permanent ID. Replacing the image with the same filename updates its appearance on existing gift walls.
- The eight original gift IDs are preserved, so earlier emoji gifts now display their matching artwork. A missing image still shows an emoji fallback.

Gifts are free, with an optional message of up to 160 characters. The received image, sender, date, and message appear together on the recipient's gift wall, subject to their profile privacy setting.

## Database setup (once)

`FirebaseRules-full.json` contains your supplied Realtime Database rules with two gift-specific changes: the gift ID validator accepts new filenames, and the gift list has a timestamp index. Publish that file in **Firebase Console → Realtime Database → Rules** before sending newly added gifts. Your existing eight gifts continue to work with the old rules.

The artwork is served from this website, so Firebase Storage and Firestore rules do not need changing. This file has not been published automatically.
