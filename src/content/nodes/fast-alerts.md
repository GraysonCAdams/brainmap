---
title: Fast Alerts
tagline: Restock alerts that beat the scalpers, for 200,000 people.
status: retired
domain: apps
tags: [infra]
started: 2021-08-01
links: []
tech: [kubernetes, celery, redis, react]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

During the chip shortage, actual humans could not buy a GPU or console before bots cleared the shelves.

## Constraints

Notification latency was the entire product; seconds decided whether an alert was worth anything.

## Approach

Concurrent scanning of hundreds of retailer pages feeding a low-latency notification fanout, on a small Kubernetes backbone.

## Edge cases considered

Retailers throttle and rearrange their pages constantly; resilience meant caching, backoff, and treating every scraper as already broken.

## Tradeoffs

Scaling notification fanout ahead of revenue; the architecture stayed lean because the wallet demanded it.

## Outcome

Grew to 200,000 users through the shortage; wound down when supply normalized. Retired, proudly.
