---
title: COD Drop
tagline: Everyone's hype song, timed so the beat lands the instant the squad jumps.
scale: 2
status: retired
domain: apps
tags: [media]
started: 2021-01-13
ended: 2023-08-29
links: [playlist-collab]
tech: [typescript, react, socket-io, spotify-sdk, python, django]
---

## Problem

Our squad had a ritual of playing a hype song on the drop, and it never landed right. Somebody had to start the track manually, everyone heard it at a different moment over voice chat, and the beat never actually hit on the jump.

## Constraints

The drop moment is not an event any API exposes. It is a fixed offset after a countdown that I could only observe by watching. And the song has to be audible to every person in the squad, on their own machine, at the same instant.

## Approach

Measure the constant, then schedule against it. I timed the plane drop at 26.11 seconds after the match countdown and added a 150 millisecond fudge for latency; that number is a named constant in the source with the comment explaining what it is. Play time is then the countdown plus the drop offset minus wherever the beat lands in the chosen track.

Version two turned every friend's browser into a registered playback device and used a socket server to broadcast prepare, play, and fade signals to all of them, with per-device latency compensation.

## Edge cases considered

If the beat drop is later in the song than the time remaining, the naive scheduler produces a negative delay and does nothing. A negative result instead starts the track mid-song at exactly the right offset, which is the behavior anyone actually wants.

Fairness needed encoding, because otherwise the loudest person's song plays every round. Selection is round-robin so everyone is heard before anyone repeats, with a thirty-day no-replay rule, a per-session blacklist, and a shuffle fallback.

The first version would announce the contributor's name over a distorted voice, which is great except when the announcement collides with the drop itself. It suppresses the announcement within about four seconds of the beat.

The proxy in front of the socket server was killing idle sessions at 100 seconds, which is well inside a normal match. That one is still sitting in the source as a comment describing the problem, because I never solved it properly.

## Tradeoffs

Everything here is calibrated against one game's timing constant, measured by hand, and that constant is invalidated by any patch that changes the drop sequence. I accepted that: the alternative was no product, for an audience of six.

The most expensive part was the least visible. Synchronizing playback across machines took about two weeks of commits that all read like "latency detection", "adjusted for latency", "fixed timing", for an outcome the users experience as the song simply being correct.

## Outcome

In active use by the squad for roughly two years. The migration file that carried version one's data into version two preserves play timestamps spanning late 2022 into 2023, which is the honest evidence that a joke project stayed in genuine use.

I also deployed it to Kubernetes on the first day of the repository, in January 2021, which in hindsight says more about where I was headed than the app did.
