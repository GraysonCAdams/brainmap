---
title: MCP Gateway
tagline: One authenticated front door for a fleet of personal AI tool servers.
scale: 3
status: shipped
domain: ai-tooling
tags: [infra]
started: 2026-06-01
links: [box-stack]
tech: [mcp, oauth, supervisord]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Every AI tool server I built needed auth, hosting, and transport, and rebuilding that plumbing per project was pure waste.

## Constraints

One public endpoint, real authentication in front of everything, servers addable without redeploying the world.

## Approach

A gateway process supervises many small tool servers on local ports and fronts them with a single authenticated tunnel.

## Edge cases considered

A public 401 is the auth challenge working, not an outage; monitoring had to learn the difference.

## Tradeoffs

Shared fate: gateway maintenance touches every tool. Worth it for one auth story.

## Outcome

Powers a growing set of personal tools used daily from chat clients.
