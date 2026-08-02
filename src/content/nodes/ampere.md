---
title: Ampere
tagline: An Alexa music skill for any self-hosted music server.
scale: 3
status: building
domain: apps
tags: [media]
started: 2026-07-25
links: []
tech: [alexa, subsonic, lambda]
---

## Problem

I have a self-hosted music library and a house full of voice speakers that could not play from it. Asking for an album out loud fell back to a streaming service instead.

## Constraints

Built against the plain, older Subsonic protocol rather than any one server's extensions, so it works with any compatible server rather than only mine.

## Approach

A skill that bridges voice requests to the library's own search and streaming endpoints, with a catalogue uploaded so the assistant knows what exists.

## Edge cases considered

**Two failure modes stop it working while every observable signal says healthy.** In both, the platform still sends a signed request for playable content, the skill still answers correctly, and the play instruction simply never arrives. It is possible to lose hours tuning a response that was never the variable.

The first: **uploading a catalogue silently unbinds the skill.** Ingestion reports success throughout, and the only symptom is that playback quietly falls back to a streaming provider, which the speaker announces in a sentence nobody parses carefully. The fix is to delete and re-set the skill's enablement afterward. The landmine is that the sync job re-uploads whenever content changes, so **adding music can silently break voice playback**, which means enablement has to be cycled at the end of any run that uploaded.

The second is stranger: **your voice alias competes with your own catalogue.** The platform resolves content before it routes to a provider, so every artist and track you upload becomes a rival for the invocation word. One name resolved to a real artist with a similar name; another collided with a band actually in my library and a well-known song, so requests arrived shaped as a track request rather than a launch. The skill was renamed several times before landing on a word that nothing in the library answers to.

Both are the same underlying lesson, and it is one I keep finding in different clothes: **a component reporting success is not evidence the system works.** The only reliable signal here is whether the music actually plays.

## Tradeoffs

Targeting the older protocol rather than the modern extensions gives up richer metadata in exchange for working against anything compatible. Being the integration layer also means owning every platform quirk permanently, and this platform has more than most.

## Outcome

Working, with the catalogue sync and the enablement cycle wired together so the fix runs automatically after the thing that breaks it.
