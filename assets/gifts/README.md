# The gift cupboard

## Add gifts from the website

Go to **Admin → Gifts**, drop in one or more images, choose a category for each image, and click **Add gifts**. Names come from the filenames and can be edited before uploading. The batch category sets the starting category for new images; **Apply to all** changes every queued image together. Individual categories stay attached to their images if you add more files or retry a failed upload. No emoji is needed. New gifts appear in the picker without republishing the website.

PNG and WebP transparency and GIF animation are preserved. Each upload can be up to 8 MB. **Hide from picker** retires a gift while keeping its artwork on previously received gifts.

**Delete image → Delete permanently** removes your uploaded image file and its catalogue entry. Previously sent gifts keep their names and messages but can no longer display that artwork. Only the original uploader can permanently delete an image; other administrators can hide it. Bundled starter files are managed in this repository.

If you published the earlier rules, publish both updated rule files in `firebase/gifts/` again to enable deletion. Once the gift has been hidden, a failed deletion keeps its catalogue entry available to retry, so its file is not abandoned in Storage.

On profiles, **Delete gift** removes only that received gift and its message. The shared image stays available to everyone else. Owners can also use **Delete note** on guestbook entries; note authors may delete their own notes. Each action asks for confirmation and shows any failure in the same tab.

Category fields let you choose an existing category or type a new one. A new name becomes a category when its gift is added, and it is suggested for other images while preparing the batch.

The Firebase rules in `firebase/gifts/` must be published once to enable this. Open `firebase/gifts/SETUP.html` for the two setup steps.

## Included starter images (optional developer workflow)

This folder holds the bundled starter set. You can still add images here and rebuild the static catalogue if you prefer:

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

The admin uploader uses Firebase Storage and the shared database catalogue. The bundled files here remain available alongside uploaded gifts.
