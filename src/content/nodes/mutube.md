---
title: Mutube
tagline: A runtime patcher that puts ad removal, SponsorBlock, and 4K back into sideloaded YouTube on Apple TV.
scale: 2
status: retired
domain: tools
tags: [media]
started: 2025-06-15
ended: 2025-09-17
links: []
tech: [reverse-engineering, ios, javascript]
---

## Problem

Sideloaded YouTube on Apple TV strips out anything Google doesn't want a jailbroken player to have: no ad removal, no SponsorBlock, and video quality capped well below what the hardware can actually decode. I built mutube to patch those limits back in at runtime rather than maintain a modified copy of the app.

## Constraints

Sideloading means no entitlements and no code signature to preserve, which rules out most of the conventional ways of shipping this kind of change. Every YouTube release moves the binary addresses the patcher hooks into, so there's no version-independent way to find its targets; each app update effectively requires re-deriving them by hand.

## Approach

mutube injects a runtime instrumentation gadget into the YouTube binary at build time, then patches two behaviors at the JavaScript layer once the app is running: it prepends a userscript loader that pulls in ad removal and SponsorBlock, and it intercepts the codec-support check YouTube's player uses to gate video quality.

## Edge cases considered

The 4K fix shipped without a real explanation for why it works. The instrumentation strips the width and height parameters out of the codec strings YouTube's player checks before offering a resolution, and after that change 4K plays. But the underlying support check still reports the codec as unsupported when queried directly, so stripping those parameters shouldn't be sufficient on its own to unlock playback. The code says so in its own comment: "I am not actually sure why this works since isTypeSupported still returns false for VP09 codecs." The working theory is that YouTube's own spoofing detection reacts to the nonsensical width and height values in a way that has a side effect on quality gating, but that's a guess written into the source, not a verified mechanism.

HDR never got fixed. The same technique that restored 4K left HDR capped, and nothing in the project resolved it; it stayed a known gap rather than a solved one.

A Frida API change between major versions broke the module base-address lookup the patcher relied on, and the fix was a straight swap to the newer API. That's evidence the tool sits on infrastructure that shifts under it independent of anything YouTube itself does.

## Tradeoffs

The tool only works against a manually decrypted IPA and only for personal sideloading; there's no path to distributing it more broadly, and that follows directly from what it does. Every YouTube version bump means going back into the binary to relocate the same hook points, which is the real ongoing cost of the approach: not runtime fragility so much as maintenance fragility, paid again on a schedule set by someone else's release cadence.

## Outcome

Working through the last version it targeted, with ad removal, SponsorBlock, and 4K restored. HDR was never solved. No commits followed the final version bump, and given the maintenance burden of re-locating hooks on every YouTube release, I'm treating it as retired rather than dormant. The project's own uncertainty about why the 4K fix works, left in as a comment rather than smoothed over, is as much the record of it as the feature list.
