---
title: Photo Restoration
tagline: Hands-off restoration for boxes of scanned family photos.
scale: 2
status: shipped
domain: media
tags: []
started: 2026-06-10
links: [vhs-restoration]
tech: [python, codeformer, lama]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Hundreds of scanned prints with glare, creases, and fading, and no appetite to hand-edit each one.

## Constraints

Fully unattended batch runs; conservative edits that never invent a face.

## Approach

A local pipeline that crops, deskews, repairs damage, and enhances faces, emitting two candidate versions per photo so a human picks, not tunes.

## Edge cases considered

Glare removal that hallucinates detail is worse than glare; the pipeline masks conservatively and leaves doubtful regions alone.

## Tradeoffs

Two output versions doubles storage but converts editing time into a swipe decision.

## Outcome

The family archive is restored and browsable.
