---
title: Playlist Collaborator
tagline: One shared playlist across Spotify and Apple Music, two years before either platform tried.
scale: 2
status: retired
domain: media
started: 2021-01-02
ended: 2021-01-08
links: [cod-drop]
tech: [python, django, spotify-api, apple-music-api, isrc]
---

## Problem

Making a playlist with a friend requires you both to use the same streaming service. We did not. Neither platform offered any cross-service collaboration, and as of today neither one does.

## Constraints

Six days, over a New Year holiday week. Both platforms' APIs had to be treated as untrusted sources of truth, since either could change out from under the other at any moment.

## Approach

A cached master playlist as the arbiter, rather than syncing the two platforms directly to each other. Each side syncs into the cache, the cache reconciles, and then the cache pushes adds and deletes back out to both. That is a three-way merge, and framing it that way rather than as two-way sync is what made the rest tractable.

Songs are matched across catalogs by ISRC, the recording industry's own identifier, because title-and-artist matching fails constantly on remasters, features, and regional releases.

## Edge cases considered

Apple's track identifiers are only unique within a storefront, so the same song has a different ID for a listener in a different country. The cache stores the storefront alongside the ID and records each user's storefront at authentication time.

Automatic matching will sometimes be wrong, so every cached song carries manual override fields for both platforms. I did not want a bad ISRC match to be permanently unfixable.

The same song can legitimately appear twice in one playlist, which breaks any reconciliation that treats a playlist as a set. Ordering is reconciled positionally with duplicate counts compared on each side.

Apple's user tokens can only be minted in a browser, which is a genuine architectural constraint rather than an inconvenience. The server signs a short-lived developer token, a single page loads the platform's own JavaScript SDK to mint the user token, and posts it back.

## Tradeoffs

I built it for a friend and did not finish it. The last commit is titled "cannot get the fucking songs to stay deleted", which is exactly right: deletion is where two-way sync gets genuinely hard, because a missing item is ambiguous between "removed here" and "not yet added here." Resolving that needs tombstones and an ordering update across every subsequent item, and I ran out of holiday.

## Outcome

Never deployed. Kept because the parts that did work, ISRC as a cross-catalog identity key, cache-mediated three-way merge, storefront-aware IDs, are the parts I would keep if I built it again, and because the invite flow was already designed for real users at the point I stopped.

Apple Music shipped collaborative playlists in 2023. Cross-platform collaboration still does not exist anywhere.
