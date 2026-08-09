#!/usr/bin/env python3
"""Catch cache-busting version numbers that have drifted out of step.

The site busts caches by hand, with a ?v= number on every <script> and
<link>. That works right up until the same file ends up referenced at two
different numbers on two different pages, at which point one of those pages
quietly serves a stale copy forever. That has happened twice:

  - admin-inbox.js was ?v=5 on account.html and ?v=6 on admin.html
  - auth.js was pinned at ?v=51 on three pages while shared.js loaded it at
    MF_ASSET_VER, so those pages never picked up a new auth.js
  - remote.html shipped a literal ?v=MFVER that nothing ever substituted

Run this before pushing:

    python tools/check-asset-versions.py

Exits non-zero and prints what to fix if anything has drifted. Files with
their own independent number (companion.js, date-night.js and so on) are
fine as long as every page agrees on it; this only complains about
disagreement, not about the number itself being old.
"""
import io
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = re.compile(r'(?:src|href)="(/[A-Za-z0-9_./-]+\.(?:js|css))\?v=([A-Za-z0-9_.-]+)"')
# These are loaded by shared.js's loadScript at MF_ASSET_VER, so a hand-written
# tag for one of them has to agree with that constant or it will go stale.
SHARED_LOADED = {"/auth.js", "/chat.js", "/profile-view.js", "/rooms.js",
                 "/notification-center.js", "/announcement-center.js"}


def html_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "downloads")]
        for fn in filenames:
            if fn.endswith(".html") and not fn.startswith("_"):
                yield os.path.join(dirpath, fn)


def main():
    versions = defaultdict(lambda: defaultdict(list))   # asset -> version -> [pages]
    for path in html_files():
        rel = os.path.relpath(path, ROOT).replace(os.sep, "/")
        text = io.open(path, encoding="utf-8", errors="ignore").read()
        for asset, ver in REF.findall(text):
            versions[asset][ver].append(rel)

    problems = []

    # 1. the same file referenced at two different versions
    for asset, by_ver in sorted(versions.items()):
        if len(by_ver) > 1:
            detail = "; ".join("?v=%s in %s" % (v, ", ".join(sorted(p)))
                               for v, p in sorted(by_ver.items()))
            problems.append("%s is referenced at %d different versions -> %s"
                            % (asset, len(by_ver), detail))

    # 2. a version that is not a number at all -- the ?v=MFVER placeholder bug,
    #    where a template token shipped unsubstituted and froze the cache key.
    #    Dotted numbers (?v=9.7) are a deliberate scheme and are left alone.
    for asset, by_ver in sorted(versions.items()):
        for ver, pages in sorted(by_ver.items()):
            if not re.fullmatch(r"\d+(?:\.\d+)*", ver):
                problems.append("%s has an unsubstituted or non-numeric version ?v=%s in %s"
                                % (asset, ver, ", ".join(sorted(pages))))

    # 3. hand-written tags for files shared.js also loads must match MF_ASSET_VER
    shared_js = os.path.join(ROOT, "shared.js")
    asset_ver = None
    if os.path.exists(shared_js):
        m = re.search(r"MF_ASSET_VER\s*=\s*'(\d+)'", io.open(shared_js, encoding="utf-8").read())
        if m:
            asset_ver = m.group(1)
    if asset_ver:
        for asset in sorted(SHARED_LOADED & set(versions)):
            for ver, pages in sorted(versions[asset].items()):
                if ver != asset_ver:
                    problems.append(
                        "%s is hand-loaded at ?v=%s in %s but shared.js loads it at "
                        "MF_ASSET_VER=%s -- those pages will serve a stale copy"
                        % (asset, ver, ", ".join(sorted(pages)), asset_ver))

    if problems:
        print("Asset version problems found:\n")
        for p in problems:
            print("  * " + p)
        print("\n%d problem(s). Make every reference to a file use the same number." % len(problems))
        return 1

    print("Asset versions are consistent (%d distinct files checked, MF_ASSET_VER=%s)."
          % (len(versions), asset_ver or "?"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
