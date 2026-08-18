---
title: Sous Chez
tagline: A cooking assistant that walks one or two cooks through a recipe with voice guidance, on web and desktop.
scale: 3
status: shipped
domain: tools
tags: [ai-tooling]
started: 2026-04-02
tech: [react, typescript, nodejs, electron, tts, anthropic-api, openai]
---

## Problem

Build an assistant that could take an arbitrary recipe, walk one or two cooks through it with voice guidance, handle ingredient scaling, and keep session state across a refresh, on both a web app and a desktop build.

## Constraints

Parsing has to infer step dependencies and reorder for efficiency, starting the rice before dicing the vegetables, rather than just transcribing the recipe's own step order. Partner mode needs explicit dependency tracking between the two chefs' steps so neither one deadlocks waiting on the other. Ingredients are referenced through template tokens so amounts can scale, which only works if the model places the amount token before the name token consistently. Voice input has to survive a session restart without interrupting the cook mid-step.

## Approach

Three tiers of model doing three different jobs: Sonnet for the accuracy-sensitive recipe parse, Haiku for real-time cooking guidance where speed matters more than depth, Haiku again for validation since it runs after the fact and cost matters there. Parsing goes through multiple passes, parse, validate, enrich ingredients, fix dependencies, as separate calls rather than one prompt trying to do all of it. Partner mode resolves the next step for each chef by checking a dependsOn graph and returning whether that chef is currently blocked. A WebSocket server keeps both chefs' clients synced in real time instead of polling. Voice output moved off a client-side Kokoro model running on WebGPU to server-side OpenAI TTS, trading local processing for something that worked reliably across browsers.

## Edge cases considered

The model would sometimes write a hardcoded amount next to the name token instead of using the amount token too, "1 tbsp {{@ing_3}}" instead of "{{ing_3}} {{@ing_3}}," which silently breaks scaling; validation now detects and rewrites it. Partner mode enforces that almost every step is assigned to one chef or the other, never "shared," because a recipe where everything is shared collapses back into single-chef mode. Dependency cycles between chefs got fixed with a dedicated Claude pass that removes them and reorders steps, rather than trying to prevent them at generation time. Recipe parsing got upgraded from Haiku to Sonnet mid-build because Haiku kept violating the dependency and reordering rules the prompt was asking for.

## Tradeoffs

The microphone stream stays open for the entire cooking session and is only released when the view unmounts. That was the fix for speech recognition restarting and triggering an engagement sound, and flickering the OS mic indicator, every time it ended a segment on Android. The code says it plainly: the stream is not released here, the session owns its lifecycle. The cost is a permanent listening indicator in the kitchen for as long as you're cooking, which is a real thing to hand someone using an assistant in their own home, and I decided it was the honest tradeoff against a phone that chirps at you every thirty seconds.

## Outcome

105 commits over eight days produced a working assistant with voice guidance, ingredient scaling, partner mode, and Electron builds signed and packaged for macOS, Windows, and Linux in CI.
