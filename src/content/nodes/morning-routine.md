---
title: Morning Routine Orchestration
tagline: The apartment notices I'm awake and gets on with it.
scale: 2
status: shipped
domain: home-automation
tags: [workflows]
started: 2026-06-15
links: [litterbox-loop]
tech: [home-assistant, automations]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

The same wake-up choreography every day: curtains, coffee, vacuum scheduling, music.

## Constraints

Never fire while asleep; recover gracefully when a phone GPS glitch lies about presence.

## Approach

A wake signal drives a single orchestrating automation, with a done-flag helper so retriggering is idempotent per day.

## Edge cases considered

One GPS blip marked the house empty at dawn and silently cancelled the whole routine; the fix was a daily done-flag plus triggers that re-arm instead of assuming.

## Tradeoffs

More helper entities to reason about, but every piece is inspectable when something misfires.

## Outcome

Mornings run themselves; edits are one automation, not five.
