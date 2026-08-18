---
title: WaterH to SparkyFitness Bridge
tagline: A stateless bridge that reads a smart bottle's daily total and logs only the difference, so a missed run can't double-count.
scale: 2
status: shipped
domain: tools
tags: [home]
started: 2026-07-24
links: []
tech: [python, reverse-engineering, oauth, mcp, nomad]
---

## Problem

A WaterH smart bottle tracks water intake accurately, but its own path into a health app is unreliable, and there's no public API to build a straightforward integration against. The data exists on one side and needs to land in SparkyFitness on a schedule, without a missed run or a restart being able to double-count it.

## Constraints

No public API meant the integration had to be derived from the vendor's own client rather than built against a documented spec, which means it can break without notice if the vendor changes anything. The token that authenticates against WaterH expires after roughly two months and has to refresh itself before that happens. SparkyFitness's own water log is additive, not something you can overwrite with a total, and that shapes the whole design. Stdlib only, no external dependencies, for a job this small.

## Approach

Every run reads WaterH's total for a day, reads what SparkyFitness already has logged for that day, and writes only the difference. Because the destination log is additive, writing the full total every run would multiply intake by the number of runs, which is the obvious failure mode and the one the whole design exists to avoid. The bridge drives SparkyFitness through the same tool interface its own official clients use rather than reverse engineering a second API, parsing whichever response format comes back. It runs as a Nomad periodic job every fifteen minutes, using the scheduler's own overlap guard so only one run is ever in flight.

## Edge cases considered

A day's WaterH total isn't final at midnight. The bottle syncs to the phone and then to the cloud, and that hop can land hours late, attributed to the day the water was actually drunk rather than the day it finally arrived. A reconcile that only checks today permanently misses anything that shows up after the day rolls over, so each run reconciles today and yesterday both, and every day still reconciles independently and idempotently.

If someone logs water manually in SparkyFitness, the next run's delta-reconcile just sees a higher existing total and logs the smaller remaining difference, absorbing the manual entry without double-counting it, for free, as a side effect of the same math that makes the whole thing idempotent.

The upstream service is intermittently flaky, returning gateway errors that resolve themselves within seconds. The retry policy is deliberately shallow: a few attempts with short backoff, then give up and let the next scheduled run pick it up fifteen minutes later. Fighting a real outage in process just turns a brief blip into a long hang, and the job runs often enough that falling through is the cheaper recovery. A partial failure, where one day's reconcile fails but another succeeds, exits successfully with a warning rather than failing the whole run, because a day that fails now self-heals on the next tick, and a job that reports failure for something that fixes itself trains you to ignore its alerts.

Tiny rounding differences between reads, a milliliter or two from unit conversion, get suppressed below a small threshold so they never get logged as if they were a real drink.

## Tradeoffs

Depending on an interface nobody publishes or supports means it can change without warning, and the honest mitigation isn't preventing that, it's making the failure loud and keeping its blast radius to one number in one health app rather than anything bigger. Driving SparkyFitness through its own tool interface instead of a REST client saved having to reverse a second API, at the cost of parsing text responses that could quietly break if SparkyFitness ever changes how it formats them.

An unrelated incident taught me something about the platform underneath. This job's frequent short-lived runs triggered a garbage collection that deleted local-only container images for a completely different service, which then failed hundreds of times trying to restart. Nothing was lost, but the lesson generalized into pinning images by digest rather than by tag, and turning that collection off.

## Outcome

Running on a fifteen-minute schedule, reconciling a rolling two-day window, verified against a real day's intake. Small, stateless apart from a cached token, and it made a health number correct again without anyone having to think about it.
