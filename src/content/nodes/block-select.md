---
title: Block Select
tagline: Click a header, select everything under it.
scale: 1
status: shipped
domain: utilities
started: 2025-10-28
links: [swiper]
tech: [typescript, obsidian]
---

## Problem

Selecting a whole section of a long note meant clicking at the start of a header and dragging until the next one, which is tedious on a long document and error-prone near the boundary.

## Constraints

A small enough annoyance that the fix has to be tiny, or it is not worth having.

## Approach

An icon on each header that selects everything beneath it, stopping at the next header of the same level.

## Edge cases considered

The stopping rule is the whole design. Selecting to the next header of *any* level would break on subsections, which are usually part of what you meant. Matching on the same level means a section takes its children with it, which is what "this section" means to a person.

## Tradeoffs

Deliberately does one thing. The temptation with a small plugin is to grow it into a section-manipulation suite, which is how a tool that works becomes a tool with settings.

## Outcome

Small, done, and submitted to the community plugin directory. Not every project needs to be interesting.
