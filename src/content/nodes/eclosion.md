---
title: Eclosion
tagline: Open-source budgeting tools built on top of a commercial finance app.
scale: 3
status: building
domain: utilities
tags: [apps]
started: 2026-01-02
links: [ynab-automation]
tech: [typescript, python, self-hosted]
---

## Problem

Having moved my budget onto a commercial service, I hit the same wall that made me leave the last one: the product does what it does, and the things I want it to do are not on its roadmap.

## Constraints

I did not want to fork the whole workflow or run my own ledger. The data lives there and should keep living there; what I wanted was room to build on top of it without asking permission.

## Approach

A modular set of budgeting tools running alongside the service, either locally or self-hosted. Underneath it sits a maintained fork of the community client library, because a project that depends on an unofficial API should own its own copy of that dependency rather than hoping upstream stays alive.

## Edge cases considered

Anything built on an unofficial API is one release away from breaking, so the integration tests that exercise the real service are kept in a separate private repository. That split matters: the public project stays contributable without handing strangers a harness pointed at live financial accounts.

Running against real money also changes the default. A tool that miscategorizes is annoying; a tool that writes confidently while wrong erodes trust in the ledger itself, which is the only thing the ledger is for.

## Tradeoffs

Extending someone else's product means permanent exposure to their decisions, and the honest version of this project's risk is that it can be ended by a change I do not control. The alternative was building a budgeting app from scratch, which is a much larger commitment to solve a smaller problem.

## Outcome

Public and open source with a live demo, stable and beta channels, and a small number of stars from people who are not me, which is the first real signal that the itch was not only mine.
