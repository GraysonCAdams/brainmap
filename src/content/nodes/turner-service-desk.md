---
title: Service Desk Integration
tagline: Two ticketing systems and two chat platforms, made to talk to each other.
scale: 2
org: Turner Broadcasting
status: retired
domain: workflows
tags: [apps]
started: 2017-05-01
ended: 2017-08-01
links: [turner-stream-monitor]
tech: [python, nodejs, jira, slack]
---

## Problem

Two service desks tracked work in separate systems, and the same issue would exist in both with no relationship between them. People maintained the link by hand, which meant the link was wrong.

Separately, the company was moving from one chat platform to another, and a bot that teams relied on only existed for the old one.

## Constraints

Neither ticketing system could be replaced, and neither team was going to change how they worked. Anything I built had to sit between them and be correct without either side cooperating.

## Approach

A sync tool that keeps corresponding tickets in step across the two systems, and a rewrite of the chat bot from the old platform to the new one, moving it from Python to Node in the process.

## Edge cases considered

Two-way sync between systems that both allow edits is a conflict-resolution problem wearing an integration costume. If a ticket changes on both sides between syncs, something has to decide which change wins, and silently picking one is how you lose somebody's work. That decision has to be explicit and visible.

Sync loops are the other hazard: a write triggered by a sync can look like a user edit and bounce back, so updates have to be attributable to their origin or the two systems will talk to each other forever.

Rewriting the bot also meant deciding how faithful to be. Users had built habits around the old one's quirks, and "improving" a command silently would have broken the muscle memory of the people who used it most.

## Tradeoffs

Integrating rather than consolidating is the compromise you make when you cannot change the organization. It leaves two sources of truth in place permanently and adds a component that can fail on its own, in exchange for not fighting a battle that was not mine to fight.

## Outcome

A ticket-sync tool bridging two service desks and a chat bot carried across a platform migration, both delivered inside one summer.
