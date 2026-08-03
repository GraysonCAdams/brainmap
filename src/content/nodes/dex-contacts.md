---
title: Dex Contacts
tagline: Mentioning a person in my notes pulls in who they actually are.
scale: 2
status: shipped
domain: tools
tags: [products]
started: 2025-10-27
links: [obsidian-quiz-generator, imap-watcher]
tech: [typescript, obsidian, carddav]
---

## Problem

Notes about people and the record of who those people are lived in two systems. Writing a name in a note created a string, not a reference, so the context stayed wherever I was not looking.

## Constraints

It had to be faster than not using it. Any friction at mention time and I would go back to typing a bare name.

## Approach

Type an at-sign, get fuzzy search over real contacts with photos, and produce a link rather than text. Memos written in notes sync back to the contact record, so the note stays the place I write and the contact system stays the place that remembers.

## Edge cases considered

Sync back to a system of record needs to be idempotent, or every pass re-uploads everything. Hashing content and comparing before writing is the cheap version of that, and it is what makes automatic syncing safe enough to leave on.

Fuzzy matching on names has a nasty failure mode: silently linking to the wrong person. Being confidently wrong about which friend a note refers to is worse than not linking at all, so the suggestion shows a photo, which humans disambiguate faster than any string metric.

## Tradeoffs

Tying my notes to a specific contacts product is real lock-in, accepted because the alternative was continuing to keep the two in my head.

## Outcome

In daily use. The pattern generalizes: an at-mention that resolves against a real system of record turns notes from prose into something queryable, without changing how it feels to write them.
