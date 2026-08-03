---
title: Litter Box Loop
tagline: Three vendors that share nothing, negotiating a cleanup between themselves.
scale: 1
status: shipped
domain: home
started: 2026-06-25
links: [morning-routine, home-assistant]
tech: [home-assistant, automations]
---

## Problem

A self-cleaning litter box cleans itself and nothing else. The tracked litter and the smell are still there, and dealing with both was manual and therefore inconsistent.

## Constraints

Three vendors with no native awareness of each other: the litter box, the robot vacuum, and the air purifier. The purifier is cloud-polled, so its state lags and its command path is unreliable in a specific way.

## Approach

A reconciler rather than a chain of notifications. A completed litter box cycle triggers a targeted vacuum run over that area and an air purge, with state checks so the devices do not fight each other or the standing schedules.

## Edge cases considered

The purifier drops the first command it receives. Not sometimes: reliably enough that the automation sends the command **twice, three seconds apart**, which is ugly and is the only thing that works. Retrying on absence of confirmation would have been the tidier design, but its reported state lags far enough that a confirmation-based retry either fires too early and stacks commands, or waits so long the purge is pointless.

Failure has to be isolated per device. Each step continues on error, so a purifier that is offline does not prevent the vacuum from running. A cleanup that partially completes beats one that aborts because a device unrelated to that half of the job was unreachable.

Re-triggering restarts rather than queues. If the box cycles again while a purge is already in progress, restarting extends the purge window instead of scheduling a second one to run after this one ends, which is what actually matches the physical situation.

## Tradeoffs

Every cross-vendor quirk now lives permanently in my automation layer, and the double-send is the kind of workaround that looks like a bug to anyone reading it later. It carries a comment saying exactly why, because the real risk is a future me deleting it as redundant and then spending an evening rediscovering the same thing.

## Outcome

Has run for months with no human involvement. The general lesson is that when a device's confirmation channel is slower than the action needs to be, idempotent repetition is a more honest fix than pretending the confirmation is trustworthy.
