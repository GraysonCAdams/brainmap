---
title: Mac Mini Music Stack
tagline: A paced Deezer-to-FLAC pipeline that enriches and indexes a self-hosted music library without double-counting a track.
scale: 3
status: shipped
domain: media
started: 2026-07-27
repo: GraysonCAdams/macmini-music-stack
links: []
tech: [python, docker, sqlite]
---

## Problem

Bulk-importing thousands of favorited tracks from Deezer into a self-hosted Navidrome library leaves everything with zero metadata: no cover art, no synced lyrics, unreliable genres, and a date-added that reflects the day of the bulk import instead of when a track was actually liked.

## Constraints

Deezer's public API caps enumeration at 5,000 tracks per playlist, so a library above that size needs authenticated enumeration instead of the public one. Downloads have to be paced, or the account risks a rate-limit ban. Navidrome's own database has to live on a real volume rather than a bind mount, or it corrupts. Only one metadata enrichment pass can run at a time, since the tagging library locks its own index.

## Approach

A daily job pulls new favorites in batches of twenty, with a random few-second delay between batches, rather than downloading as fast as the API allows. Genre comes primarily from Discogs, with Last.fm as a fallback, written with a single separator character so Navidrome's own scanner doesn't shred multi-word genres like "Folk, World, & Country" into three separate tags. Lyrics come from a fuzzy match against artist, title, and duration against LRCLIB, skipped if a synced lyrics file already exists locally. A separate pass backfills each track's date-added from a cached export of Spotify like history, matching normalized artist and title, so the library's recently-added view reflects when a song was actually liked rather than when it was bulk-downloaded.

## Edge cases considered

Some tracks fail to download repeatedly. After three failed attempts a track gets parked in a separate unreachable list instead of retried forever, as a candidate to find elsewhere.

Tracks that never matched anything in the date-backfill pass kept whatever date the scanner gave a fresh download, which is today, so unmatched tracks were sorting to the top of the recently-added view and making a mature library look freshly imported. Eighty-six tracks were doing this. The fix parks unmatched tracks at a neutral date old enough to fall out of that view, guarded so a date can only ever move backward, which means it can never override a track that already has a correct, more recent date.

A long manual catch-up run and the nightly job must never run against the same Deezer session at once; two downloader processes racing against one session trip rate limiting and race on the same tracking database. A single-instance guard makes the second one exit quietly instead of fighting the first, and the schedule just picks it up on the next firing.

Navidrome has to rescan after tagging finishes, not before, or files that land just ahead of their own metadata get indexed as Unknown Artist and stay that way until the next full rescan.

## Tradeoffs

Downloads are capped at a fixed daily maximum and spread across paced batches, so a library this size takes a long stretch of calendar time to fully sync rather than finishing in one run. That's a deliberate trade against the alternative, which is Deezer rate-limiting or banning the account outright.

The date backfill only runs against a manually exported snapshot of Spotify's like history, not a live sync, so newly liked tracks there don't automatically get a correct date in Navidrome. That's simplicity traded against staying current.

## Outcome

A working daily pipeline serving around 9,300 fully tagged FLAC tracks over Subsonic to desktop and mobile clients. About three quarters of the catalog matched back to its real Spotify like date; the rest sit at the neutral placeholder. A few hundred tracks that never came down cleanly are parked in a separate list for sourcing elsewhere.
