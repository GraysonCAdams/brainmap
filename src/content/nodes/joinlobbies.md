---
title: JoinLobbies
tagline: The generalized rewrite, spanning fifteen games across every platform.
scale: 3
status: retired
domain: products
started: 2014-07-01
ended: 2017-07-01
links: [adventurelobbies, halolobbies]
tech: [php, mysql, oauth, javascript]
---

## Problem

AdventureLobbies solved matchmaking for exactly one game, and the architecture that made it work, cloning Minecraft worlds onto Bukkit servers, was inseparable from that game. Every other multiplayer community had the same coordination problem and none of them could use it.

## Constraints

Generalizing meant giving up the thing that made the first product special. AdventureLobbies did not just match players, it provisioned the server they played on. No such lever exists for console games, where the platform owns matchmaking and I own nothing.

## Approach

Drop provisioning entirely and keep only the coordination layer. In the site's own words, a free service "accessible by gamers of every platform" whose purpose was "to enhance the matchmaking experience for a variety of games and allow gamers to organize events." Fifteen games at its widest, OAuth sign-in, event RSVPs, and paid promotion slots for hosts who wanted reach.

## Edge cases considered

Once the product stopped provisioning anything, the only asset was trust in the listing, so most of the design effort moved to reputation and event scheduling rather than infrastructure. That shift is what the whole rewrite was actually about, and it is why the next product narrowed back down.

## Tradeoffs

Breadth cost depth. Serving fifteen communities loosely was strictly less compelling to any one of them than serving Minecraft players completely, and the honest read is that the generalized version never mattered to its users the way the specific one did. I learned that lesson well enough to immediately act on it: HaloLobbies, built the following year, went back to a single game.

## Outcome

Live from July 2014 through mid-2017; the domain lapsed that summer. graysonadams.com redirected here for most of that run, which is the clearest signal of how I thought about it at the time.

An unresolved thread remains in the record: something was suspended in 2015 and I have not yet recovered what. I would rather leave the gap visible than fill it with a guess.
