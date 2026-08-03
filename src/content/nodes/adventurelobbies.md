---
title: AdventureLobbies
tagline: Free Minecraft adventure-map hosting that served over a million sessions while I was in high school.
scale: 5
status: retired
domain: products
tags: [platform]
started: 2012-01-01
ended: 2014-07-01
links: [gtotechnology, joinlobbies]
tech: [java, bukkit, mysql, php, linux, ftp]
featured: 2
---

## Problem

Minecraft adventure maps were meant to be played with friends, but playing one together meant somebody had to run a server: rent a box, install the right Bukkit build, upload and configure the map, whitelist everyone, and tear it down afterwards. Almost nobody did. The maps got played single-player or not at all.

## Constraints

I was sixteen, the service had to be free, and I was the only person operating it. That ruled out anything requiring per-session human attention, and it ruled out paying for idle capacity.

## Approach

Pick a map, name your friends, get a private pre-configured server for the session. A PHP site wrote a row into a `lobbies` table; a fleet of Linux game servers each ran a custom Java Bukkit plugin that self-registered by matching its own address against a `servers` table and polled for lobbies assigned to it. The database was the message bus. There was no API between the website and the game servers, because a shared MySQL table already gave me durability, assignment, and a state machine for free.

Servers wiped their world and player directories between sessions and cloned each map fresh, so every box was disposable and interchangeable.

## Edge cases considered

Cloning a world into three copies for the overworld, nether, and end breaks Bukkit, which refuses duplicate worlds. Deleting the world's identity file from the clones made it accept them. That fix then broke portal linking, because the custom three-world layout defeated vanilla portal math, so I reimplemented the 1:8 nether coordinate scaling by hand against CraftBukkit internals. That decision pinned the entire service to Minecraft 1.4 permanently, which was the single largest piece of technical debt in the project.

Lobby creators needed to teleport and set the weather in their own session, but giving them real server op would have let them touch the box. I intercepted the vanilla-style commands before they ran and reimplemented them against a database ownership check, so hosts got op-like powers with none of the authority.

Shutdown had to assume players were mid-game. If anyone was online when a server went down, the lobby was marked paused rather than killed so another server could resume it, with a heartbeat timestamp written back for the fleet to reason about.

## Tradeoffs

Polling a database instead of building a real control plane was the right call at that scale and the wrong one at any larger scale. It cost me a queue, a retry policy, and any way to observe the fleet. It also meant I shipped, alone, in high school.

The security of the code was poor by any standard I would accept now: most queries were built by string concatenation against player-supplied names. I know exactly which ones, and the contrast with how I handle credentials today is the whole reason that arc is worth showing.

## Outcome

The site's own counter read **1,078,950 submitted lobbies** in a February 2014 snapshot. The forum carried roughly 2,200 matchmaking threads and a dedicated cheater-reporting category with over 600 more, which is to say moderation became a real operational load rather than an afterthought. Across its two-year run my resumes of the period record **500,000 unique visitors and roughly 4.27 million pageviews**, with about 100,000 registered members. Funding came from donor tiers wired directly into the forum's role table and enforced in-game by live queries, alongside a partnership with the hosting provider.

Superseded in mid-2014 by JoinLobbies, which generalized the idea past Minecraft.
