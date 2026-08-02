---
title: Telemetry Pipeline
tagline: A Python service shipping 120+ million metrics into three observability backends.
scale: 3
status: retired
domain: infra
tags: [utilities]
started: 2020-01-01
ended: 2021-07-01
links: [warnermedia-eks-migration]
tech: [python, datadog, elk, zabbix]
---

## Problem

Vital signals from a large production estate needed to reach the tools people actually watched, and those tools were not the same tool. Different teams had standardized on different backends, and telling them all to converge was not on the table.

## Constraints

Volume high enough that per-metric overhead matters, and three destinations with different ingest shapes and different failure behavior.

## Approach

One collection path, several emitters. Gather once, then fan out, so a backend being added or removed is a change in one place rather than a change to every instrumented service.

## Edge cases considered

The failure mode that matters in telemetry is the one where the pipeline is down and everything looks calm. Absence of alerts is indistinguishable from health unless the pipeline reports on itself, so the monitoring needs monitoring, and it must not depend on the same path it is checking.

Backpressure also has to be a decision rather than an accident. When a destination slows down, something has to give, and choosing to drop metrics deliberately is much better than discovering which ones your buffer chose to lose.

## Tradeoffs

Fanning out to three backends means paying three times for storage and keeping three query languages in the team's head. That was the price of not forcing a migration on teams who had good reasons for their choices.

## Outcome

Over 120 million vital metrics transmitted, plus an alerting application covering more than ten legacy systems that had no instrumentation of their own. Those were the ones nobody could see into, which made them the ones most likely to fail quietly. The lesson that generalized: a monitoring system that cannot detect its own silence is not a monitoring system.
