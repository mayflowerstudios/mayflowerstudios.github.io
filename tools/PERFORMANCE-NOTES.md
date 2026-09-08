# Browser performance review — September 7, 2026

This change reduces verified sources of browser work. It does not establish the
cause of the reported Opera GX crash.

## Changes

- Notifications consume child updates, retain unread records in the UI, and
  batch bursts into one scheduled render. A closed bell renders no items; the
  open bell renders up to 30. The full inbox pages through 50 at a time without
  hiding older unread items or changing which items “Mark all read” covers.
- Hidden tabs defer notification rendering. Repeated profile updates reuse the
  current subscription, and late account requests cannot overwrite a new account.
- Account profile and presence listeners detach when the account changes.
- Translation releases removed text nodes, releases tracking when returning to
  English, caps the in-memory cache at 4,000 entries, and stops applying results
  to removed content or continuing batches for a language that was deselected.
- Video pauses decorative canvases even without screen wake-lock support.
- Shared script, account script, and profile stylesheet cache versions agree
  across the site, including the radio and bot pages.

## Verification

- `node --test tools/*.test.mjs`: 81 passed, 3 failed, 1 optional diagnostic skipped.
  The same three failures existed before this change: the gift rules tests cannot
  find `firebase/gifts/database.rules.json`, deleted in commit `8b60635f`.
- `python tools/check-asset-versions.py`: passed, 24 assets checked.
- Node syntax checks: 44 tracked JavaScript files/inline scripts passed.
- Local browser: homepage, signed-out notifications, and Together; notification
  fixture with 5,125 records, paging, bell scrolling, and mark-all behavior.
  Desktop and 390px viewport checks passed without observed console errors.
- Automated notification stress test covers 10,000 records, hidden tabs,
  failed writes, older unread items, and account-switch races.

## Remaining limits

The Firebase notification query still initially synchronizes history, so the
Firebase SDK may retain more data than the unread-only UI. Bounding that initial
transfer while preserving every unread item requires a verified unread index/data
model and deployed rules. Those backend files are absent from this checkout;
no production rules or data were changed.

Signed-in live database flows, real multi-person video/screen sharing, and Opera
GX crash reproduction were not exercised. The checks above are not a guarantee
against every browser, device, network, or extension issue. Changes are local and
have not been published.
