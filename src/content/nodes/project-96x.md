---
title: Project 96X
tagline: An AI radio DJ that drops station IDs and song intros into a live Spotify stream shared over Discord.
scale: 2
status: building
domain: media
started: 2026-05-22
links: []
tech: [python, discord, typescript, tts, ffmpeg]
---

## Problem

Live radio DJ imaging, station IDs, song announcements, bridges between songs, is scripted and repetitive when it's done by hand. A friend group listening to Spotify together in Discord wanted the feel of a real radio station dropping in between tracks without anyone recording it themselves, so I built project-96x to generate and play those drops in real time.

## Constraints

The trigger is a Spotify songchange event that a Spicetify extension forwards to a Discord bot as a webhook. From that one moment the bot has to measure how much of the song is left, decide what to say, render the audio, and tell Spotify when to duck or pause, all inside a one to two second budget. Every drop that isn't pre-rendered goes through ElevenLabs and Claude, both too slow and too costly to call for every single song. The test suite has to be dry-run only: no network, no audio devices, no live Spotify or Discord calls, so it stays safe to run against a station that's actually live.

## Approach

Every transition anchors to one timestamp: the moment the extension's webhook request arrives. All later scheduling computes its delay relative to that arrival time rather than to whenever rendering finishes, so render latency cancels out instead of accumulating. The decision of what to play, in what mode, and when, comes from a pure function that takes the drop and the song's geometry and returns a plan, with no I/O and no clock inside it; the webhook handler just executes what the function returns. A generation token increments on every songchange, and any scheduled action whose token no longer matches the current one aborts, replacing what used to be a chain of nested timeouts. A cadence engine decides how often each drop type fires: announcements can run every song, station IDs land every two or three songs on a randomized threshold that re-rolls after each firing, bridges every four to eight. Most transitions come from a pre-rendered pool keyed by category pair and tier and rotated so nothing repeats back to back; the LLM only runs when the pool misses.

## Edge cases considered

The bug that drove the anchor-timestamp design was real and shipped once: the old code slept for the drop's start delay counted from after rendering finished, so the bot-side pause and the Spotify-side duck drifted apart by however long rendering took, and music kept playing during what was supposed to be a commercial break. Anchoring every delay to the webhook's arrival time instead of the render's completion time fixed it, because render latency now cancels instead of shifting the whole transition late.

A stale Discord voice connection can report itself as connected while streaming no audio at all. Detecting that silent-but-connected state comes down to watching for a stream that's stopped producing new samples, on top of a separate guard against double-starting playback. The hold window that keeps a drop playing over dead air only ever extends, never truncates, so a short webhook that arrives while a longer drop is already running can't cut it off early.

## Tradeoffs

Pool-first, LLM-as-fallback trades some variety for cost and latency. Live Claude and ElevenLabs calls are gated to songs where an announcement is actually likely to fire rather than run speculatively on every track.

The generation token is a plain incrementing counter instead of wall-clock timeouts, which is simpler to reason about but means every scheduled action has to poll whether its token is still current, with no background sweep of the stale ones.

## Outcome

58 commits over about three weeks rebuilt the timing model, mixer, and cadence engine from the ground up. The planner is exhaustively unit tested precisely because it takes no I/O and no clock. It hasn't run yet with real friends in a live Discord channel; what exists is the architectural foundation, built specifically so the timing holds once it does.
