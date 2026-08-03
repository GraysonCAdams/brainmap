---
title: Outage Tooling
tagline: Automated outage intake and on-call alerting, leading the team that built it.
scale: 3
org: AT&T
status: retired
domain: tools
tags: [platform]
started: 2024-06-01
ended: 2024-09-01
links: [att-azure-migrations, home-assistant]
tech: [kubernetes, argocd, prometheus, grafana, terraform]
---

## Problem

Outage response was slower than it needed to be, and most of the lost time was not diagnosis. It was intake: finding out, routing it, and getting the right person looking at the right signal.

## Constraints

Leading rather than building, across several parallel initiatives, on a short tenure. That puts a premium on choosing work that would still be maintained after I moved on.

## Approach

Attack the parts of the timeline that are pure overhead. Automate outage intake so a report becomes a tracked, routed thing without a human transcribing it. Build on-call alerting that reaches the right person. Put a dashboard in front of application metrics so the first question in an incident has an answer before anyone asks it.

## Edge cases considered

Alerting systems fail toward noise, and noise is worse than silence because it trains people to ignore the channel. An alert that fires often and is usually not actionable actively degrades response time for the alerts that matter.

The intake path also has to work when the thing being reported is the thing that is down, which rules out depending on the affected system for the report itself.

## Tradeoffs

Dashboards are easy to build and easy to over-build. A dashboard nobody looks at during an incident is decoration, so the useful constraint is designing for the two minutes after a page rather than for a review meeting.

## Outcome

Outage resolution times improved substantially. The broader thread is that this is the same instinct as the very first home automation I ever wrote, which was also a server up-and-down alert: most of the value in operations is in noticing quickly.
