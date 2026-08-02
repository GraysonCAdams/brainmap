---
title: Modded Minecraft Server
tagline: A private modded server for friends, run on my own hardware.
scale: 2
status: retired
domain: apps
tags: [infra]
started: 2019-01-01
ended: 2021-12-31
links: [homelab-kubernetes, adventurelobbies]
tech: [minecraft, forge, java, linux]
---

## Problem

Playing a heavily modded pack with friends needs a server that stays up, holds a consistent modset, and does not lose the world. Rented game hosting handles that badly for modded play and charges for the privilege.

## Constraints

Modded servers are memory-hungry and unforgiving about version drift: every player needs exactly the server's modset, and a mismatch fails in confusing ways rather than clearly.

## Approach

Run it on my own hardware alongside everything else the homelab hosted, with the modpack pinned and exported so joining meant installing a known-good set rather than assembling one.

## Edge cases considered

The failure that actually costs you is world corruption, and it usually arrives through an unclean shutdown or a mod update mid-save. Backups need to be frequent and, more importantly, taken at a consistent point rather than while chunks are being written.

Modpack updates are a coordination problem more than a technical one. The server and every player have to move together, so the useful design is making the pack itself the distributed artifact rather than a list of instructions.

## Tradeoffs

Self-hosting traded a monthly fee for being the person who gets told the server is down, usually while doing something else. For a small group of friends that was a fine trade, and it was the same trade I had already made at much larger scale years earlier with the Minecraft hosting service, just without anyone else's expectations attached.

## Outcome

Ran across several modpack generations with world backups preserved. One of many things the homelab hosted rather than the reason it existed.
