---
title: Family Movies Gateway
tagline: End-to-end-encrypted family videos, streaming to the living room TV.
status: shipped
domain: media
tags: [apps]
started: 2026-07-05
repo: GraysonCAdams/ente-jellyfin
links: [vhs-restoration]
tech: [go, jellyfin, encryption]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Our family archive lives in an end-to-end-encrypted photo service, which is exactly why no TV app can play it.

## Constraints

Keep the encrypted service as the source of truth; no plaintext library copy sitting on disk.

## Approach

A gateway that authenticates to the encrypted cloud, decrypts server-side on demand, and presents a standard media-server API that TV clients already speak.

## Edge cases considered

TV clients direct-play only what looks like plain files; streaming decrypted segments in a player-friendly container was the difference between transcoding everything and playing instantly.

## Tradeoffs

The gateway holds keys at runtime, concentrating trust in one audited component.

## Outcome

Home movies play on the TV like any other library; open-sourced for other families.
