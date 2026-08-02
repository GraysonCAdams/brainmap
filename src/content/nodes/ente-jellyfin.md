---
title: Family Movies Gateway
tagline: End-to-end-encrypted family videos, streaming to the living room TV.
scale: 4
status: shipped
domain: media
tags: [apps]
started: 2026-07-05
repo: GraysonCAdams/ente-jellyfin
links: [vhs-restoration]
tech: [go, jellyfin, encryption]
---

## Problem

The family home movie library lives in end-to-end encrypted cloud storage, which is right for the archive and wrong for watching. Nobody wants to open a photo app to watch home movies on a television.

## Constraints

End-to-end encryption means there is no server-side pull API by design, so anything that reads the library has to decrypt as a client. The media server needed to see something it could hand to a player directly, and the players that matter are the native ones on televisions and phones.

## Approach

A gateway that holds the client session, decrypts, and presents the library to a standard media server as ordinary files. The catalogue is generated as one lightweight stub per clip pointing at the gateway, so the media server indexes thousands of items without storing any of them.

## Edge cases considered

**The core fix was making the stream boring.** The source's preview format is a non-standard variant that native players refuse and the media server flags as not directly playable, which forces transcoding, which the native players then also refuse. The result was a library that looked complete and played on nothing.

Decrypting server-side and serving a plain progressive stream instead solved it in one move: the media server sees an ordinary container, marks it directly playable, and every player works. The lesson generalizes past this project. When a chain of components each degrade politely, the failure surfaces at the end as "unsupported" with no indication of which link caused it, and the fix is usually to present something conventional rather than to make each link smarter.

Not every clip has a preview, so those fall back to the decrypted original. Roughly one in six takes that path.

Metadata was a second dead end. The media server ignores sidecar files for home-video libraries specifically, so dates and locations have to be written through its API afterward. Without that, several thousand clips sort by import date rather than by when they were actually shot, which for a family archive destroys the only ordering anyone cares about.

Durations do not populate until first playback, because probing a remote stub is deferred. A separate pass pre-populates them, since a library where every item claims zero length looks broken even though it plays fine.

## Tradeoffs

The gateway is the trust boundary by construction: it is the component holding the session that can decrypt, so it sits behind a tunnel rather than on the open internet, and its exposure is the thing to keep smallest. That is the honest cost of putting an encrypted archive in front of a media server that expects plain files.

Generating a flat catalogue also means it is a snapshot rather than a live view, so adding content means re-running the generation and the enrichment. Simpler to reason about, and it fails in a visible way rather than a subtle one.

## Outcome

The family library is watchable on televisions and phones, with correct dates and locations, and it direct-plays rather than transcoding. Nearly four thousand clips, organized into collections and per-year playlists.
