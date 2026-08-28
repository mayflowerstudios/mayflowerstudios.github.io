Mayflower Studios Stripe World Store - Storage Region Fix

Your Firebase Storage bucket is in us-east1.
Firebase requires a Cloud Storage event function to run in the same region as that bucket.

This build changes only stripPaidWorldDownloadToken to us-east1.
The Stripe HTTPS functions remain in us-central1, so the Stripe webhook URL does not change.

Because your previous setup already saved the Stripe secrets and published Database/Storage rules,
you do NOT need to redo the full setup.

Run:
  RESUME-STRIPE-SETUP.bat

It will:
  1. install/update the Functions dependencies
  2. deploy the four corrected Functions
  3. leave the window open if anything fails

Do not rerun the full setup unless you actually want to recreate the Stripe webhook/secrets.
