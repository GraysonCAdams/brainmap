---
title: Spotify Sorter
tagline: Auto-routes new Spotify likes into playlists; built around Spotify's undocumented, punitive rate limit as the real problem.
scale: 2
status: shipped
domain: media
started: 2026-04-17
tech: [typescript, nodejs, sqlite, docker, spotify-api, anthropic-api]
---

## Problem

Liked Songs on Spotify is a pile, not a library. I wanted new likes routed automatically into the playlists they actually belonged in, matched against playlist descriptions I'd already written, with a UI to watch it work and a way to backfill the whole existing library once.

## Constraints

Spotify does not publish its rate limits, and going over them is punitive rather than gentle. Refresh tokens rotate on every call to the token endpoint, so the new value has to be written to disk immediately or the app can't reauthenticate after a restart. Per-track signal for classification is often thin: no audio features, no Last.fm tags, nothing to go on. And a full backfill of Liked Songs can run for hours, so it has to survive a restart mid-run rather than starting over.

## Approach

A token bucket rate limiter, one request per second with a 30-token burst, feeding a circuit breaker: any 429 trips a fail-fast state for all Spotify calls, held for a minimum of ten minutes or twice whatever Retry-After said, whichever is longer, with exponential backoff capped around five hours if it keeps happening. Classification runs cheap first: Haiku by default, upgraded to Sonnet only when a track has neither audio features nor Last.fm tags to go on, with the system prompt cached so hundreds of routing calls don't each pay full price. Backfill runs as its own persisted worker, pausable and resumable from the UI, seeding a dedupe store from existing playlists before it touches Liked Songs so nothing gets routed twice.

## Edge cases considered

The circuit breaker's state gets loaded from disk on construction, not just held in memory, because a process that bounces after a 429 and forgets it was just throttled will walk straight back into the same throttle. The refresh token write has to happen on every single rotation, not once at boot: a crash between rotations otherwise leaves a stale token that fails on the next start. Spotify changed the shape of its own playlist-items endpoint without warning in February, renaming a field from `track` to `item`, and the fix shipped the same week I hit it in production. Audio features turned out to be a weak tie-breaker at best; Last.fm tags carried the real classification signal, and I demoted audio features after watching them produce bad routes.

## Tradeoffs

The rate limiter is more machinery than a naive catch-429-and-retry loop needs: a token bucket, a circuit breaker, persisted state, exponential backoff. I chose it because reacting to a failure after it happens means you've already eaten the throttle. Running deliberately slow, one request per second, before ever hitting a limit, cost throughput but meant the app never tripped Spotify's penalty box in the first place.

## Outcome

Running on Fly.io with CI that deploys on a green build and polls the health endpoint before calling the deploy done. Thirty-one commits over a week got it from nothing to a working pipeline: routing, backfill, rate-limit safety, and a UI to watch the decisions get made.
