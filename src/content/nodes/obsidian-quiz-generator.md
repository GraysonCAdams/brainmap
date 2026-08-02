---
title: Quiz Generator
tagline: Took over an abandoned plugin that turns notes into exam questions.
scale: 2
status: shipped
domain: ai-tooling
tags: [apps]
started: 2025-11-03
links: [dex-contacts]
tech: [typescript, obsidian, anthropic-api, ollama]
---

## Problem

The plugin I relied on for generating practice questions from my own notes had stopped being maintained, and the model landscape it was built against had moved on underneath it.

## Constraints

Taking over someone else's project means inheriting their design decisions and their users. Both deserve more care than a rewrite would have given them.

## Approach

Fork, become the listed maintainer, and modernize rather than redesign: multiple model providers including a local option, more question types, and keeping the existing workflow intact for people already using it.

## Edge cases considered

Generated questions are worthless if they test recall of the generator rather than the material. A question whose answer is only inferable from the phrasing feels like a question and teaches nothing, so the useful constraint is that the answer must be recoverable from the source note.

Supporting a local model alongside hosted ones is not just a provider switch. Output quality and instruction-following differ enough that prompt shapes which work on one produce malformed output on another, and the parsing has to be forgiving without silently accepting nonsense.

## Tradeoffs

Maintaining a fork means either tracking upstream forever or accepting the divergence. Upstream had stopped, which made the decision for me, but it also means anyone still on the original is now on a different plugin than they think.

## Outcome

Maintained and substantially ahead of the original. Adopting an abandoned tool you personally depend on is usually cheaper than replacing it, and it is a decent way to end up maintaining something real.
