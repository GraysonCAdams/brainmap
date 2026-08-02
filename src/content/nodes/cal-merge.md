---
title: Calendar Merge
tagline: Many calendars in, one clean shared calendar out.
scale: 2
status: shipped
domain: utilities
tags: [workflows]
started: 2026-06-20
links: [box-stack]
tech: [python, caldav, nomad]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Sharing availability across work and personal calendars meant either oversharing details or endless manual copying.

## Constraints

Work events must appear as anonymous busy blocks; the merged calendar must update itself.

## Approach

A small scheduled service reads each source calendar, normalizes and anonymizes as configured, and writes a single merged calendar others can subscribe to.

## Edge cases considered

Dead source calendars shouldn't wedge the merge; config had to move out of the container image so sources can change without a rebuild.

## Tradeoffs

Polling cadence trades freshness for API quota. Fifteen minutes turned out to be plenty.

## Outcome

Running unattended; the merged calendar is the one everyone actually looks at.
