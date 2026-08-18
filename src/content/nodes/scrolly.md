---
title: Scrolly
tagline: A private, invite-only video feed for one friend group, paced by a watch-to-post credit economy.
scale: 3
status: shipped
domain: media
started: 2025-02-28
links: []
tech: [svelte, typescript, sqlite, twilio, playwright]
---

## Problem

A friend group wanted somewhere to share video clips that wasn't TikTok or Instagram: no public feed, no algorithm, no data collection beyond what the group itself generates. I built scrolly as a private, invite-only reel app scoped to a single group.

## Constraints

Membership is phone-verified and each phone number belongs to exactly one group. Scrolly doesn't bundle a downloader itself; the host installs a provider like yt-dlp at runtime through settings. The whole app runs as one Node process rather than a set of services, because a group of five to twenty people doesn't justify the ops overhead of splitting it up.

## Approach

Posting costs a credit, watching earns one. Watch someone else's clip and you earn a credit; spend a credit to post your own. New members start with a small seed balance so they aren't locked out on day one.

Clips sit in a personal holding queue between download and posting, capped by size, so a member can't stockpile an unlimited backlog waiting to spend credits all at once. They move through a status pipeline: downloading, then pending trim for music clips or straight to ready for video clips, then watched or favorited. A failed or removed clip is never hard-deleted, only marked deleted, so attribution on existing comments and reactions survives. Download providers sit behind a small pluggable interface; yt-dlp is the default and there's a fake provider for tests.

## Edge cases considered

Turning the credit economy on over a group with an existing content backlog creates an obvious exploit: every old clip is still watchable, but none of them mint credits. A launch cutoff timestamp draws that line, so adopting reciprocity can't convert a backlog into a flood of free posting credits for whoever joined early.

Credits are spent at publish time, not at enqueue time, so a download that fails never costs a member anything. Music clips that need trimming get a default 30 second window, with the client sending heartbeat pings to extend it; when the pings stop, a scheduler auto-publishes the clip rather than let it stall in the queue indefinitely.

Behind a reverse proxy, SvelteKit can't infer its own public URL. Without an explicit ORIGIN environment variable set, POST requests fail their CSRF check with a silent 403 that never reaches the app's own logging, which took real time to trace back to a proxy misconfiguration rather than an app bug. Authenticated sessions also carry Set-Cookie headers large enough that nginx's default 4KB proxy buffer clips them, so logged-in requests started returning 502s that anonymous requests never hit.

## Tradeoffs

SQLite over Postgres, despite knowing Postgres better, because zero ops beats headroom at this scale. It's fine for a group this size and would need real work somewhere around a million clips.

Every post costs exactly one credit, with no sliding scale by quality or effort. That closes off the obvious ways to game a graduated cost, and it treats every member's post as equally valuable, which is what a friend group actually wants out of a pacing mechanism, not a content platform optimizing for engagement.

## Outcome

273 commits from first commit to the last major feature, running in production for the one friend group it was built for. The credit economy replaced an earlier clout and cooldown system partway through. A Playwright and Vitest test suite landed later in the project, and clip downloads were hardened to H.264 for browser compatibility as one of the more recent changes.
