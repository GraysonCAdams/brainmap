---
title: Are.na Toolkit
tagline: My moodboards, wired into my AI assistant.
status: shipped
domain: ai-tooling
tags: [media]
started: 2026-07-18
repo: 312-dev/arena-mcp
links: [mcp-gateway]
tech: [mcp, typescript]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Visual research lives on curation boards, but my assistant couldn't see or add to any of it.

## Constraints

Respect the platform's API limits; reject dead or low-quality images before they pollute a board.

## Approach

A tool server wrapping the curation platform's API: search, create, and maintain boards conversationally.

## Edge cases considered

Image URLs that resolve but render broken (dead redirects, oversized sources) needed validation before adding, not after.

## Tradeoffs

Third-party API coverage decides the feature ceiling; some curation still belongs to hands and eyes.

## Outcome

Season moodboards are now maintained mid-conversation; open-sourced.
