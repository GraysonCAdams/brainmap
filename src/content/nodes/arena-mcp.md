---
title: Are.na Toolkit
tagline: My moodboards, wired into my AI assistant.
status: shipped
domain: ai-tooling
tags: [media]
started: 2026-07-18
repo: 312-dev/arena-mcp
links: [mcp-gateway]
tech: [typescript, mcp, sharp, rss]
---

## Problem

I wanted a visual reference library for personal style, and the obvious platform has filled with generated images. A human-curated alternative existed, but nothing connected it to the assistant I actually work in, so saving and retrieving references stayed manual.

## Constraints

The service's older API was being wound down mid-build, and the newer one is largely undocumented. Search requires a paid tier I do not have. And the whole thing is worthless if the saved references do not render, because a board of broken thumbnails is not a reference library.

## Approach

An MCP server built against the current API, derived by probing live endpoints and writing the findings down in the repository as I went. Then a companion pipeline that guarantees every saved item has a real, verified image.

## Edge cases considered

**Image validation is the entire product**, and it took the most iterations by far. When the platform cannot extract an image from a page, it screenshots the page instead. Modern brand sites render as blank or as an error page, which produces a large image file that passes any naive "does it have an image" check and is visually dead.

The fix is to validate pixels rather than presence: reject images below a standard-deviation floor, above a brightness ceiling, or under a minimum dimension. That single check is the difference between a board that looks curated and one that looks broken.

Dead links needed their own detection. A product URL that redirects off its product path to a category page is dead, and that specific pattern turns out to be the signature of a fabricated product reference. An automated curator will invent plausible-looking product numbers, and the redirect is how you catch it.

No single fetcher works. A browser-style user agent retrieves some brands, the platform's own fetcher retrieves others, and neither covers the set. Running both and taking whichever produces a valid image was the only thing that worked.

Some documented lore turned out to be half wrong, which I corrected: deleting a block *entity* is refused, so the received wisdom was to rebuild an entire board to remove one item. But deleting the block's *connection* to the board works fine. That turns a full rebuild into a surgical edit, and it only surfaced by testing the assumption instead of inheriting it.

## Tradeoffs

Building against an undocumented API means every finding has a shelf life, which is why the derivation lives in the repository rather than in my head. The paid search tier is simply unavailable, so that tool returns the limitation honestly rather than pretending to work.

## Outcome

Public and running, with a weekly scheduled job that pulls from a set of feeds, curates, runs everything through the same validation pipeline, and posts what survives.

The design that made it durable was separating taste from hands: one component decides what is worth saving, another guarantees it is saved correctly. Neither has to know much about the other.
