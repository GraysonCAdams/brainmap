---
title: Legacy Containerization
tagline: Rewriting old codebases into modern ones without breaking what people relied on.
scale: 3
status: retired
domain: infra
tags: [apps]
started: 2021-07-01
ended: 2024-06-01
links: [att-azure-migrations]
tech: [java, python, coldfusion, docker]
---

## Problem

Working software written in languages and runtimes that were no longer maintainable, still doing real work for real users. Rewriting it is risky; leaving it is a slower kind of risk.

## Constraints

The behavior had to survive even where it was undocumented, because undocumented behavior is still behavior somebody depends on. Some of these systems predated everyone currently maintaining them.

## Approach

Containerize first to make the thing reproducible, then rewrite behind that boundary. Getting an old application to build and run identically in a container is unglamorous and is the step that makes everything after it safe, because it gives you something to compare against.

## Edge cases considered

The most dangerous rewrites are the ones where the old system's bugs are load-bearing. Downstream consumers adapt to quirks, and faithfully fixing a defect can break someone who had already worked around it. That has to be a deliberate decision, made with the consumer, not a silent improvement.

The user interface question came up repeatedly and was never purely technical. Sometimes the right answer was to preserve a dated interface exactly, because retraining thousands of users was the real cost, not the frontend work.

## Tradeoffs

A faithful port produces something that is modern underneath and still shaped by decisions made a decade ago. A redesign produces something better and takes much longer to trust. Choosing per system, rather than picking one policy, meant slower decisions and better outcomes.

## Outcome

Several legacy codebases rewritten and containerized onto modern runtimes, some preserving the original interface exactly and some redesigned, depending on where the cost actually sat.
