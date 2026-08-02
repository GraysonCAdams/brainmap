---
title: Box Stack
tagline: A cloud fleet's worth of personal apps, consolidated onto one orchestrated server.
scale: 4
status: shipped
domain: infra
tags: [utilities]
started: 2026-07-10
links: []
tech: [nomad, docker, cloudflare-tunnel]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

A dozen small personal apps scattered across a PaaS added up to real money for workloads a single modest server could carry.

## Constraints

Every app isolated enough that one runaway can't take down the rest; instant rollback; no public inbound ports.

## Approach

One orchestrator, per-app resource limits, tunnel-based ingress, and images pinned by digest so a deploy that reports success actually shipped.

## Edge cases considered

Mutable image tags silently serving stale builds was the sneakiest failure; digest pinning became the rule after one "successful" deploy changed nothing.

## Tradeoffs

A single box is a single failure domain. Backups and boring restore drills are the price of the savings.

## Outcome

The whole personal fleet runs on one server at a fraction of the previous cost.
