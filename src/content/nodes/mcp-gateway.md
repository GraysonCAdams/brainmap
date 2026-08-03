---
title: MCP Gateway
tagline: One authenticated front door for a fleet of personal AI tool servers.
scale: 3
status: shipped
domain: ai-tooling
tags: [platform]
started: 2026-06-01
links: [box-stack]
tech: [mcp, oauth, supervisord]
---

## Problem

I kept building small tool servers for my assistant to use, and each one needed the same things: a public address, authentication, and somewhere to run. Doing that per server meant the auth story drifted between them, which is exactly how a gap appears.

## Constraints

One authenticated front door, no per-server auth decisions. Everything reachable from a hosted assistant, which rules out anything that depends on being on my network. And a hard rule that no backend is protected by obscurity.

## Approach

A single job running every tool server on its own local port under one supervisor, fronted by a worker at the edge that performs the authentication. A public request hits the worker, the worker authenticates it, and only then does it reach a backend.

## Edge cases considered

The most instructive failure looked like a working system. The framework's default mode issues a session identifier on initialize and rejects any follow-up without it, so the assistant completed the handshake successfully and then loaded exactly zero tools. Nothing errored. Forcing the stateless mode fixed it, but the fix demanded a distinction I had been sloppy about: protocol statelessness is not process statelessness. The process is still long-lived, so the state left behind by an authorization step genuinely does survive between requests, which I verified deliberately rather than assumed.

Joining a private network exposed every service bound to all interfaces to any peer on that network, completely bypassing the edge authentication that is the only app-layer control. I confirmed it by reaching a service from a peer with no challenge at all. The fix was to block all inbound on that join, which cost nothing because the join only ever needed to make outbound connections. The general shape is worth keeping: adding a network is adding an attack surface, and the default posture of most joins is more permissive than the reason you joined.

The backend addresses themselves were originally guessable, which is to say protected by nothing. They now sit behind their own access policy with the front-end worker holding the only credential that passes, so human traffic hits a login it cannot complete.

One tool reported adding twenty-five items to a cart when two were silently unavailable, and the shortage only surfaced at pickup. Worse, when asked, the assistant guessed confidently at which items were missing and guessed wrong. The fix attaches real availability data and splits the result explicitly into unavailable, at risk, and no data reported, because four of those items publish no stock information at all and the absence of a warning is not evidence of stock.

## Tradeoffs

Everything shares fate. One process tree behind one gateway means a restart cycles every server at once, and a deploy of the shared image is a single point of failure. That is a real cost I accepted for having exactly one auth story instead of nine.

I also deliberately downgraded the deployment pipeline from automatic to build-check-only after moving hosts, because an automatic deploy pointed at the old target would have put a second tunnel and a second network agent into conflict with the live one. Losing automation was cheaper than that failure.

## Outcome

Running as a single job with every server behind one authenticated edge. Two behaviors worth writing down because they look like outages and are not: an unauthenticated request to a public endpoint returns a 401 because the challenge is working, and a backend refusing a direct hit is also correct.
