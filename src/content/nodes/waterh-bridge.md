---
title: Hydration Bridge
tagline: A smart water bottle's cloud, reverse-engineered into my own health tracker.
scale: 2
status: shipped
domain: utilities
tags: [home-automation]
started: 2026-07-01
links: []
tech: [python, reverse-engineering, nomad]
---

## Problem

A smart water bottle tracks intake accurately and exports it into a health app through a multi-hop chain that had silently stopped working. The data existed on one side and never arrived on the other, with nothing reporting an error.

## Constraints

No public API, so the integration had to be derived from the vendor's own client. Stdlib only, because a job this small should not carry a dependency tree. And the destination's water log is **additive**, which shapes the entire design.

## Approach

Poll the source for the day's total, compare it to what the destination already has, and write only the difference. Because the destination adds rather than sets, writing the total every run would multiply intake by the number of runs, which is the obvious bug and the one the whole thing is built to avoid.

## Edge cases considered

**A day's total is not final at midnight.** The bottle attributes a late sync to the day you actually drank, so a reconcile that only looks at today permanently orphans anything that arrives after the rollover. I found this by losing a real amount across a date boundary. The window is now rolling and covers yesterday as well, so late arrivals get picked up on the next pass.

The upstream service is genuinely flaky, intermittently returning gateway errors with no healthy backend, worst around local midnight. Three separate things in my own code turned a sixty-second blip into a total run failure, and all three were mine rather than theirs: only one class of error was caught, so socket-level failures escaped as an unhandled crash; retries existed only for token refresh and not for server errors; and the reconcile exited on the first bad day, abandoning the rest of the window.

The retry policy is deliberately **shallow**. Three attempts with short backoff, then give up and let the next scheduled run handle it. Fighting a real outage in-process just converts a brief failure into a long hang, and the job runs frequently enough that falling through is the cheaper recovery.

Partial failure now exits successfully with a warning, because one bad day out of two self-heals on the next tick, and a job that reports failure for a condition that fixes itself trains you to ignore its alerts.

## Tradeoffs

Depending on an undocumented interface means it can break without notice, and the mitigation is that the failure is loud and the blast radius is one number in a health app.

An unrelated incident also taught me something about the platform underneath: this job's frequent short-lived runs triggered garbage collection that deleted local-only container images for a completely different service, which then failed hundreds of times trying to restart. Nothing was lost, but the lesson generalized into pinning images by digest and turning that collection off.

## Outcome

Running on a schedule, reconciling a rolling window, verified against a real day's intake. Small, boring, and it made a number I care about correct again.
