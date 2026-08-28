MAYFLOWER STUDIOS - PAID WORLD DOWNLOAD DESIGN

This build intentionally does NOT use a Cloud Storage event trigger and does NOT
require Google Eventarc/Pub/Sub IAM setup or signed-URL signing permissions.

Paid .world files are encrypted in the Admin browser with AES-256-GCM before the
encrypted bytes are uploaded. The encryption key is stored only in the private
worldPrivate database node. The public site cannot read that node.

After Stripe verifies a purchase, worldDownload verifies the signed-in Firebase
account owns the world and returns the encrypted-file URL plus its decryption key.
The buyer's browser decrypts the file locally and saves the original .world file.

Because a purchaser can always redistribute a file after legitimately downloading
it, encryption is intended to prevent unpaid direct downloads, not DRM against a
legitimate purchaser.

If you had uploaded a PAID world using one of the earlier builds, edit that world in
Admin and re-select/re-upload its .world file once. That converts it to the new
encrypted format.
