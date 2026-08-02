---
title: VHS Restoration Pipeline
tagline: Decades of family tape, restored to something worth watching.
status: shipped
domain: media
tags: [workflows]
started: 2026-05-01
links: []
tech: [ffmpeg, topaz, python]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

A closet of degrading VHS captures nobody could stand to watch: noise, tears, timing drift.

## Constraints

Faces must stay true; archival originals never modified; the process repeatable for every tape that follows.

## Approach

A standardized local pipeline: capture, timing repair, ML upscaling and denoising, then metadata so the results file correctly into the family library.

## Edge cases considered

Broken presentation timestamps silently desync audio a half-hour in, so the pipeline validates timing health before any expensive processing.

## Tradeoffs

Local processing is slower than cloud farms but keeps family footage private and costs nothing per run.

## Outcome

Two years of tapes restored; the pipeline is the standard for the rest.
