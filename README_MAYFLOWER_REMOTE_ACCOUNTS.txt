MAYFLOWER REMOTE — FIREBASE ACCOUNT SETUP
=========================================

The updated Windows app uses the same Firebase Authentication project as this
website. No website login code needs to be replaced.

ONE REQUIRED FIREBASE CHANGE
----------------------------
Merge the contents of firebase-rules-mayflower-remote-snippet.json into the
TOP LEVEL of your existing Realtime Database "rules" object, then publish the
rules.

Example shape only:

{
  "rules": {
    "users": { ...your existing users rules... },
    "rooms": { ...your existing room rules... },
    "remoteDevices": { ...paste the remoteDevices block here... }
  }
}

Do not replace your full rules file with the snippet by itself.

WHAT IS STORED
--------------
remoteDevices/<your Firebase uid>/<device id>/ contains:
- the friendly PC name
- an internal random relay room
- an internal random end-to-end encryption secret
- online / last-seen status

The database rules allow only the signed-in owner to read or write that user's
device list. The Windows app stores its Firebase refresh token with Windows
DPAPI. Installing unattended hosting also stores a machine-protected copy so
the LocalSystem host service can reconnect after boot.

CURRENT SIGN-IN METHOD
----------------------
This build supports Firebase email/password sign-in. Existing accounts created
with email/password work directly. The Windows app includes a Forgot / set
password button that sends Firebase's password email for accounts that need a
password credential.
