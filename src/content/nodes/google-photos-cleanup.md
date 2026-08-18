---
title: Google Photos Cleanup
tagline: A local tool that culls a photo library after Google cut off the API, and never deletes anything it can't get back.
scale: 3
status: shipped
domain: tools
tags: [media]
started: 2026-03-29
links: [photo-restore]
tech: [python, typescript, sqlite]
---

## Problem

Google deprecated third-party read and delete access to Google Photos on March 31, 2025. There is no official API path left for an application to manage or clean up a user's library. I wanted a local tool that could look at a library, tell me what was worth keeping, and get rid of the rest, without giving up on the idea entirely just because Google closed the front door.

## Constraints

Nothing could leave my machine. No cloud calls, no telemetry, the whole analysis pipeline local. With the official API gone, the only way in was to have a browser extension read the library the same way the Google Photos web page itself does when I'm looking at it, which meant the extension could never delete anything directly either; every deletion still has to go through Google's own trash, which holds a photo for 60 days before it's actually gone. The heavier analysis tiers, quality scoring and a vision model, had to be optional, since not every machine running this has a GPU or Apple Silicon to spare.

## Approach

An extension on the Google Photos page enumerates the library and ships thumbnails and metadata to a local backend in batches. From there a four-tier pipeline does the judging: OpenCV heuristics for blur, exposure, and faces; perceptual hashing to catch duplicates; optional quality scoring; and, only for photos that land in "review" rather than an outright keep or delete, an optional local vision model for a second opinion. A classifier turns those tags into a verdict, and the one rule that actually drives it is that content changes what a quality flaw means: a blurry photo from a kid's birthday is a review, a blurry photo of nothing is a delete. Nothing gets removed straight from the pipeline. Everything lands in a dashboard first.

## Edge cases considered

Deduplication had to compare a new batch of photos against each other as well as against everything already in the database, or two near-identical shots landing in the same batch would slip past each other. Corrupted or missing image data gets safe defaults instead of crashing a tier and stalling the whole run. And the closed-eyes signal from face detection stayed a soft tag rather than a hard quality issue on purpose, since eye detection on a small compressed thumbnail throws enough false positives that trusting it fully would have deleted photos that were actually fine.

## Tradeoffs

Reading the library through the same requests the web app makes instead of an official API means this can break the moment Google changes how that page works, and there's no support contract to fall back on. Vision-model review only runs on the photos already sitting in "review", not on the ones already headed for deletion, trading a slower but more thorough second look for speed on the bulk of the library. The whole thing, backend, four-tier pipeline, extension, dashboard, tests, and a Material Design pass on the UI, was sixteen commits in one sitting; I built it in a day because the API sunset didn't leave a slower option, and some rough edges got left for a version that hasn't happened yet.

## Outcome

For something that deletes a person's own photos, the deletion path is the least clever part of the design on purpose. Favorites always keep. Any photo with a face never auto-deletes no matter how many quality issues it has; it goes to review instead. Every deletion goes to Google's own trash, never a permanent delete, and the extension shows a confirmation naming the 60-day recovery window before it acts. Nothing leaves the dashboard without a human having looked at it. The guard rails are most of what I actually built here.
