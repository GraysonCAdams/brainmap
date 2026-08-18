---
title: Quiz Generator
tagline: Forked a dormant Obsidian plugin I was relying on and pushed it further for a semester of studying.
scale: 2
status: retired
domain: ai-tooling
tags: [products]
started: 2025-11-03
ended: 2026-03-01
links: [dex-contacts]
tech: [typescript, obsidian, anthropic-api, ollama]
---

## Problem

The plugin I used to generate practice questions from my own notes had gone quiet. Its last release was a year old, its issue list had been accumulating without answers, and the model landscape it was built against had moved on underneath it. I needed it to keep working more than I needed to be right about who should fix it.

## Constraints

Working inside someone else's codebase means inheriting their design decisions, and a fork I intend to actually use is not the place to relitigate them. I also had no interest in becoming a maintainer. The upstream project was dormant, not dead, and the honest scope was a fork I ran for myself rather than a succession.

## Approach

Fork and extend rather than redesign. The work landed over about a week: quizzes generated from questions I had previously missed, AI-written hints, customizable quiz titles, an export path, audio caching for spoken questions, and a gamification layer to make repetition less unpleasant. The largest piece was file selection, which had to filter candidate notes, count tokens, and show what it had auto-selected, so that pointing it at a folder produced a usable quiz instead of a context-window error.

## Edge cases considered

Generated questions are worthless if they test recall of the generator rather than the material. A question whose answer is only inferable from its own phrasing feels like a question and teaches nothing, so the constraint that matters is that the answer has to be recoverable from the source note.

Supporting a local model alongside a hosted one is not just a provider switch. Output quality and instruction-following differ enough that a prompt shape which works against one produces malformed output from the other, so the parsing has to be forgiving without silently accepting nonsense.

Spending money per quiz changes how a study tool feels to use. Gating generation behind an explicit key and a credit check, rather than letting it quietly bill in the background, keeps the cost visible at the moment you choose to incur it.

## Tradeoffs

Maintaining a fork means either tracking upstream forever or accepting divergence. Upstream had stopped, which made that decision for me, and it also means these changes never went back: I opened no pull request and the original is still the version everyone else uses.

## Outcome

Nineteen commits, taking the plugin from where its author left it to something that fit how I actually studied, and archived once I stopped needing it. It is a small piece of work, and the honest description is a personal fork rather than a project I took over.
