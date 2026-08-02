---
title: Fast Alerts
tagline: A chip-shortage restock alert service, built and run with a friend.
scale: 2
status: retired
domain: apps
tags: [infra]
started: 2021-09-12
ended: 2021-09-17
links: []
tech: [python, django, discord]
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
