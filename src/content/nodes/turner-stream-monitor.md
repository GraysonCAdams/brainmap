---
title: Live Stream Monitoring
tagline: A Django platform watching a dozen live broadcast streams at once.
scale: 3
org: Turner Broadcasting
status: retired
domain: media
tags: [infra, apps]
started: 2017-05-01
ended: 2017-08-01
links: [turner-service-desk, warnermedia-eks-migration]
tech: [django, python, hls, docker]
---

## Problem

Live streams fail in ways that are obvious to a viewer and invisible to a server. The process is up, the bitrate looks fine, and the picture is frozen. Someone has to notice, and during a broadcast, noticing late is the whole problem.

## Constraints

An internship, so a summer to deliver something real. The streams were access-controlled, which meant the monitor could not simply be pointed at a public URL.

## Approach

A platform that watches many streams concurrently and surfaces their health in one place, handling the token-based access the streams required rather than working around it.

## Edge cases considered

The interesting question in stream monitoring is what counts as broken. A stream can be serving valid segments that decode to a still frame, or drifting out of sync, or perfectly healthy but stale because the encoder upstream stopped. Checking whether the endpoint responds catches almost none of the failures anyone actually cares about, so the definition of health has to be chosen deliberately.

Access tokens expire, which means a monitor that authenticates once will start reporting outages that are really its own expired credentials. Distinguishing "the stream is down" from "I can no longer see the stream" matters enormously, because those pages wake up different people.

## Tradeoffs

Watching more streams at higher fidelity costs proportionally more compute, and a monitor that becomes expensive gets scaled back until it stops being useful. Choosing the cheapest check that still catches real failures was most of the design.

## Outcome

Delivered a Django platform monitoring roughly a dozen live streams, and presented the summer's work to the company's chief technology and chief financial officers.

Two years later I was migrating the production workload for live streaming platforms at the same company after it was renamed. The internship was a preview of the job.
