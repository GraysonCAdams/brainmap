---
title: Pull.fm
tagline: A music discovery engine with a record-store owner's taste.
scale: 4
status: building
domain: apps
tags: [media, ai-tooling]
started: 2026-07-15
links: []
tech: [typescript, postgres, llm]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Algorithmic recommendations converge on the same forty songs; real discovery feels like a knowledgeable human pulling records.

## Constraints

Every recommendation must name a specific verifiable fact, and only point at music a reader can actually go hear.

## Approach

A curation pipeline that assembles candidate crates, enriches them with verifiable context, and drafts notes in a strict editorial voice with hard rules against template filler.

## Edge cases considered

An implausibly clean data join usually means the join is wrong, not the data is good; verification steps must be able to fail or they're theater.

## Tradeoffs

A hard monthly model-spend ceiling caps how much can be generated, which forces curation over volume.

## Outcome

In active build; early crates pass the "would a record-store owner say this" test.
