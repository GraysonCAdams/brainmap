---
title: Litter Box Loop
tagline: The litter box, the vacuum, and the air purifier negotiate among themselves.
scale: 1
status: shipped
domain: home-automation
tags: []
started: 2026-06-25
links: [morning-routine]
tech: [home-assistant, automations]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

A self-cleaning litter box still leaves tracked litter and smell, and the downstream cleanup was manual.

## Constraints

Devices from three vendors that share nothing natively.

## Approach

A reconciler automation: litter box completion triggers a targeted vacuum run and an air-purge cycle, with state checks so devices don't fight.

## Edge cases considered

The purifier confirms mode changes slowly, so the automation waits on reported state, not commands sent.

## Tradeoffs

Cross-vendor glue lives in my automation layer, which means I own every quirk.

## Outcome

The loop has run for months without human involvement.
