---
title: feedBulletin
tagline: A forum reader that learns each site's markup with a model instead of shipping a scraper per forum.
scale: 3
status: shipped
domain: tools
tags: [ai-tooling]
started: 2026-05-18
tech: [tauri, svelte, typescript, sqlite, anthropic-api]
---

## Problem

Forum people spend their time hopping between Reddit, vBulletin, XenForo, Discourse, phpBB, and a handful of older forum platforms that are still very much alive, each with its own structure and no shared thread view between them. The aggregators that already exist render everything as a generic feed or an iframe, which throws away exactly the metadata and culture that makes a forum feel like a forum.

## Constraints

The app needed one thread view across platforms with genuinely different markup: Reddit, vBulletin, XenForo, Discourse, phpBB, IPB, SMF, and Ubiquiti's own forum software. It needed real per-author metadata, avatar, rank, post count, join date, karma, location, not just the post text. And it had to support seventeen user-switchable themes that all had to render correctly regardless of which of those platforms the underlying post actually came from.

## Approach

Rather than write and maintain a scraper per forum platform, which rots the day any one of those sites changes its markup, the app learns. On a forum's first visit, the page structure goes to Claude, which returns the CSS selectors for posts, authors, and metadata; the result is cached locally, and every later visit to that host reads from the cache instead of calling the model again. The whole interface resolves through around sixty CSS custom properties per theme, so a new skin is a palette swap rather than new markup, and a theme can be pinned to one specific forum in config so a single site can run in Matrix Rain while everything else stays vB classic. Avatar enrichment pulls a real profile picture where the source forum has one and falls back to a deterministic pattern, keyed to the user, when it doesn't.

## Edge cases considered

The learned selector cache is per-host and local, and there is no automatic re-learn trigger, so a forum that changes its markup after being learned has to be caught and re-learned by hand rather than noticing on its own. Quote blocks resolve back to their actual parent post instead of embedding static quoted text, which means handling a quote whose parent has since been deleted. vB4-style first-post highlighting was duplicating itself on re-render and had to be deduped. A dead avatar CDN link falls back to a silhouette instead of a broken image, and every site-profile delete now logs a backtrace, which reads like a stage of the pipeline that was still surprising its own author enough to want to know exactly when and why it fired.

## Tradeoffs

Learning a forum's structure through a model call trades a moment of latency and an API cost on first visit for never hand-writing or maintaining a scraper again; making discovery part of the product, instead of an engineering chore that has to be redone every time a forum redesigns, was the actual point. Re-rendering threads natively strips out embeds and each site's own styling in exchange for one dense, consistent layout, and the local-only database means a learned forum doesn't sync across devices.

## Outcome

Eleven commits, all landed the same day, shipped a working desktop app: the learned-selector pipeline, seventeen themes verified through Playwright screenshot galleries, avatar enrichment, and quote resolution, ending on a commit titled initial release of feedBulletin.
