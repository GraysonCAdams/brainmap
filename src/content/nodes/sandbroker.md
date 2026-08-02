---
title: Sandbroker
tagline: Agents can use my secrets but can never see them.
scale: 4
status: building
domain: security
tags: [ai-tooling]
started: 2026-07-20
links: [mcp-gateway]
tech: [go, biometrics, sandboxing]
featured: 2
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

AI agents need credentials to do useful work, and every path that gives them a credential also gives them the ability to leak it.

## Constraints

Zero secret values in agent context, ever. Frictionless for everyday use, human-approved for sensitive scopes.

## Approach

A local broker daemon holds the secrets; agents invoke pinned verbs and get back success or failure, never values. Sensitive vaults require a biometric approval per session.

## Edge cases considered

An agent asking politely for the value is the easy case; the hard ones are side channels through error messages, logs, and tools that echo their inputs.

## Tradeoffs

Every new service needs a pinned verb defined by a human. That friction is the security model working.

## Outcome

Running daily in dev; production cutover in progress.
