---
title: HaloLobbies
tagline: Built over one Christmas break; 20,000 sessions in the first month.
scale: 3
status: retired
domain: products
started: 2015-12-01
ended: 2016-07-01
links: [joinlobbies]
tech: [php, mysql, jquery, xbox-live]
---

## Problem

Halo 5's matchmaking paired you with strangers who were frequently muted and always gone after one game. Anyone wanting a recurring group for custom games, Forge, or campaign co-op had no way to find one and no way to keep one.

## Constraints

One week, over Christmas break, alone. Halo 5 had launched in October and the window for riding that wave was closing.

## Approach

Persistent lobbies published by hosts, browsable and filterable, with live green or gray status showing whether the host was actually in-game on Xbox Live at that moment. Hosts accrued a reputation score from the people who played with them.

## Edge cases considered

The presence indicator was the whole product, and Xbox privacy settings hide online status from non-friends, so for most users it would have silently shown gray forever. Rather than drop the feature or ask people to weaken their privacy settings globally, I ran a dedicated bot account and told users to friend it. That gave the site visibility into exactly one signal, from users who opted in one at a time, with no change to how they appeared to anyone else.

I deliberately did not build messaging. The "request invite" button deep-linked straight into Xbox's own messaging instead, on the reasoning that every additional in-site step was a step away from actually playing. Chat rooms arrived later, as an option rather than the path.

Reputation needed a floor as well as a ceiling. Ratings ran from "excellent" down to a level that auto-banned the host from listing, with negative-reputation names struck through in the browser rather than hidden, so the community could see the judgment rather than just its effect.

## Tradeoffs

Choosing one game meant accepting the ceiling that comes with one game's population, and that ceiling arrived on schedule. It was still the right call: the single-game version outperformed the fifteen-game version it followed, and by a wide margin.

## Outcome

**20,000+ sessions between December 24 and January 24**, split evenly between new and returning visitors, and a thousand social followers in the first month. The traffic claim holds up against independent evidence: sequential lobby IDs in archived captures show roughly 900 lobbies created in three weeks of January 2016.

Last healthy snapshot July 2016. The third and final product in a teenage line that ran Minecraft, then everything, then back to one game.
