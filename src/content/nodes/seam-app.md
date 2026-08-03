---
title: Seam
tagline: An Android messenger that treats each platform as a pluggable piece.
scale: 3
status: building
domain: products
started: 2025-12-28
tech: [kotlin, jetpack-compose, android, bluebubbles]
---

## Problem

Messaging is fragmented by platform, and every app that tries to unify it either becomes a lowest-common-denominator inbox or gets shut down. I wanted the architecture to survive one of its sources disappearing.

## Constraints

Android, and no telemetry. The messages passing through this are the most private data I handle, and the only way to make that claim credible is to not collect anything at all.

## Approach

Two extension points with deliberately different jobs. Connections to platforms are one kind of module, and cross-platform features are another. Keeping those separate means a feature written once works across every connected platform, and adding a platform does not mean reimplementing the features.

## Edge cases considered

Cross-platform features have to degrade rather than fail when a platform cannot support them. Something like sharing an arrival time is native on one protocol and has to be synthesized on another, and pretending both are equivalent produces a confusing experience on the weaker one.

Message identity across platforms is the other hard part, and it is the same problem I hit years earlier trying to sync playlists between streaming services: the same conversation exists twice with different identifiers, different ordering guarantees, and no shared key.

## Tradeoffs

A modular architecture costs more up front than a direct implementation, and for a personal project that cost is real. The bet is that the modules outlive any individual platform integration, which is the only way a project like this survives contact with a vendor decision.

Licensed noncommercially rather than permissively, which is a deliberate limit on where it can go.

## Outcome

In progress. The architecture is the point rather than feature count.
