---
title: Todoist Bridge
tagline: Tasks captured anywhere end up in one list.
scale: 2
status: shipped
domain: tools
tags: [tools]
started: 2025-12-02
links: [morning-routine]
tech: [typescript, docker, google-tasks, alexa]
---

## Problem

Tasks arrive through whatever is nearest: a voice assistant while cooking, a phone's built-in list, a work account. They then sit in three places, which means the real list exists nowhere and I stop trusting any of them.

## Constraints

Capture has to stay wherever it already is, because the whole value of saying a task out loud is that it takes two seconds. Changing my habits was not on the table; the software had to absorb the mess.

## Approach

One-way synchronization from each source into a single destination, so the sources stay valid capture points and exactly one place is authoritative.

## Edge cases considered

Sync loops are the obvious hazard and duplicates are the visible symptom. Something has to remember that a given task already crossed over, and it has to survive restarts, because the pipeline that forgets on restart will cheerfully re-import everything the next morning.

Completion is the harder question. If a task is completed in the source after syncing, propagating that is a design decision rather than an obvious behavior, and getting it wrong resurrects finished work.

## Tradeoffs

One-way rather than two-way was chosen deliberately. Two-way sync between task systems with different data models is a conflict-resolution problem, and I had already learned from trying to do exactly that with playlists that the deletion path is where it becomes genuinely hard.

## Outcome

Shipped as a public container image with continuous integration and documentation, which is more packaging than a personal tool strictly needs. It picked up an outside user, which is usually the moment a script becomes a project.
