---
title: Voicemail Portal
tagline: A Node.js portal for voicemail and directory, built during a co-op.
scale: 2
status: retired
domain: apps
tags: [utilities]
started: 2016-01-01
ended: 2016-12-01
links: [ksu-student-media, turner-stream-monitor]
tech: [nodejs, javascript, splunk]
---

## Problem

Voicemail and directory lookup lived in systems designed for phones rather than for people at computers, so routine tasks meant navigating an interface built around a keypad.

## Constraints

A co-op position at a large telecom, which meant working inside existing systems that predated me by a long way and could not be changed to suit a web front end.

## Approach

Build a web portal over the existing capability rather than replacing anything underneath, so the value shows up immediately and nothing load-bearing has to move. Alongside that, wireframing work to settle what the interface should be before building it, and log analysis to understand actual usage rather than assumed usage.

## Edge cases considered

Putting a friendly front end on a telephony system means inheriting its state model whether it fits or not. Voicemail has notions of read, saved, and deleted that do not map cleanly onto what a web interface implies, and papering over the mismatch produces an interface that lies about what will happen.

Log analysis was also where my assumptions went to die. What people actually did with the system was measurably different from what the design conversations assumed, which is an argument for looking at logs before drawing wireframes rather than after.

## Tradeoffs

Wrapping rather than replacing means the portal can only ever be as good as what it sits on, and any limitation underneath becomes a limitation users blame on the portal. It also meant shipping something real in a co-op term instead of proposing something ambitious that would outlive my badge.

## Outcome

A working Node.js portal for voicemail and directory access, plus wireframes and usage analysis that informed it.

This was my first exposure to enterprise systems where the constraint is organizational rather than technical, which is most of what senior infrastructure work turns out to be about.
