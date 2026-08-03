---
title: Brain Map
tagline: This site. A living graph of ideas and what became of them.
scale: 3
status: building
domain: products
tags: [ai-tooling]
started: 2026-08-02
repo: GraysonCAdams/brainmap
links: []
tech: [astro, d3-force, canvas, cloudflare-pages]
---

## Problem

Ideas and shipped projects accumulate across repos, notes, and memory, but nothing shows the connective tissue: how one idea spawned another, which ones shipped, and how problems actually got approached.

## Constraints

Static output only, fast on mobile, navigable by a recruiter in 90 seconds, and maintainable in minutes per update or it will rot.

## Approach

One markdown file per node with a fixed narrative template; the filename is the slug. A build step compiles frontmatter into a graph JSON that a single canvas island renders. Every node is also a plain static page, so the graph is an enhancement, not a dependency.

## Edge cases considered

Teaser nodes must appear on the map without their content ever entering the client payload. Dead links rot silently, so integrity is checked in three layers at build and on a weekly schedule. AI crawlers get split treatment: trainers blocked, assistants served clean markdown.

## Tradeoffs

Hand-rolled canvas rendering over a graph library: more code, but full control of the aesthetic and a tiny payload at this node count.

## Outcome

You are looking at it.
