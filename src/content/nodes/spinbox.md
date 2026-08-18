---
title: Swapify
tagline: Collaborative Spotify playlists with swipe reactions, built from nothing to production in four days.
scale: 3
status: shipped
domain: media
started: 2026-02-19
links: [playlist-collab, spotify-sorter]
tech: [nextjs, react, typescript, postgresql, spotify-api, anthropic-api, oauth]
---

## Problem

A shared Spotify playlist has no way to signal engagement. Co-curators can't see whose picks are landing, the order is static, and adding a track doesn't tell anyone anything. I wanted collaborative curation layered on top of a real Spotify playlist, not a separate app that happens to also hold music.

## Constraints

Spotify's OAuth is PKCE-only, no client secret allowed in the browser, which meant handling the token exchange and session myself rather than reaching for an off-the-shelf auth library. The database had to run against real Postgres in production and an in-memory database locally without the two drifting apart. Email invites needed to be secure and single-use without standing up a separate invite service. Push notifications had to degrade cleanly on browsers that don't support them.

## Approach

The entire interaction model is swipe right to vibe, swipe left to skip. Reactions, not comments or star ratings, are the curation signal, on the theory that the lower the friction on the ask, the more honest the answer. A vibe sort reorders the shared playlist by combining reaction counts with Spotify's own audio features. Claude Haiku names each playlist automatically from its track metadata, a Daylist-style label instead of whatever the creator typed in a hurry. OAuth is a custom PKCE flow with server-side iron-session, built without NextAuth to keep direct control over a handshake Spotify is strict about.

## Edge cases considered

The Drizzle migration journal drifted out of sync with production twice, once around migration 0017 and again at 0018 and 0019, missing journal entries that only showed up once the app was already live. Migrations were made idempotent afterward so a retried run couldn't leave the schema half-applied. Swipe gestures on mobile had to be tuned so they didn't collide with the browser's own back and forward swipe, and inputs needed explicit keyboard types after the default keyboard kept covering the field it was supposed to be filling in.

## Tradeoffs

Rolling custom PKCE instead of using NextAuth traded a maintained library for direct control over a flow Spotify doesn't give much room to get wrong, and that control mattered more than the convenience would have. A Claude call per playlist for the vibe name adds latency and cost to something that could have returned instantly, in exchange for a label with actual personality instead of "Playlist 3."

## Outcome

Fifty commits over four days, February 19 to 22, the last one titled production readiness: security, email, funnel sync, component refactoring. Shipped as an installable PWA on Fly.io.
