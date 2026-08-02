---
title: Ampere
tagline: An Alexa music skill for any self-hosted music server.
scale: 3
status: building
domain: apps
tags: [media]
started: 2026-07-29
links: []
tech: [alexa, subsonic, docker]
---

> Draft placeholder seeded during construction; the real write-up lands soon.

## Problem

Voice assistants happily stream from big services but not from the music library you host yourself.

## Constraints

Work with the standard open music-server API so anyone's server qualifies, not just mine.

## Approach

A voice skill that maps requests onto the open API's search and streaming endpoints, with a setup wizard that automates the platform's least-documented steps.

## Edge cases considered

The platform silently disables a skill when its catalog uploads, and a recreated skill can sit half-provisioned where search resolves but playback never starts; the wizard now cycles enablement automatically because of both.

## Tradeoffs

Building on an assistant platform means inheriting its opaque failure modes. The wizard exists to absorb them.

## Outcome

Voice playback works; polishing the onboarding before sharing it.
