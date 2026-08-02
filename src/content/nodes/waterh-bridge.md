---
title: Hydration Bridge
tagline: A smart water bottle's cloud, reverse-engineered into my own health tracker.
status: shipped
domain: utilities
tags: [home-automation]
started: 2026-07-01
links: []
tech: [python, reverse-engineering, nomad]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

The smart bottle logs every sip into a walled-garden app that shares with nothing I use.

## Constraints

No official API exists; the bridge must reconcile rather than double-count.

## Approach

Pulled the vendor API out of the mobile app, then built a scheduled poller that delta-reconciles readings into my self-hosted fitness tracker.

## Edge cases considered

The vendor logs totals while my tracker logs additive entries; naive syncing double-counts every poll, so the bridge computes deltas against its own ledger.

## Tradeoffs

Unofficial APIs mean the app update that breaks it is always coming. The poller fails loudly instead of guessing.

## Outcome

Hydration shows up in the same dashboard as everything else, untouched by hand.
