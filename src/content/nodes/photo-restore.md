---
title: Photo Restoration
tagline: Hands-off restoration for boxes of scanned family photos.
scale: 2
status: shipped
domain: media
tags: []
started: 2026-06-10
links: [vhs-restoration]
tech: [python, codeformer, lama]
---

## Problem

Boxes of printed photographs, camera-scanned rather than flatbed-scanned, which means every image arrives tilted, surrounded by scan surface, sometimes upside down, faded, and with a glare hotspot where the light hit the print.

## Constraints

Hands-off. Hundreds of images at a time, so anything requiring a decision per photo defeats the purpose. And restoration has to keep faces recognizable rather than making them merely sharp, because a beautifully restored photograph of someone who now looks like a stranger is worthless.

## Approach

Crop and deskew, auto-orient, restore and upscale, correct color, then inpaint glare. Every image produces **two** finals, with and without glare removal, because inpainting sometimes wins and sometimes invents, and letting a person pick is cheaper than getting it right automatically.

## Edge cases considered

**Cream margin detection has to use color, not brightness.** The scan surface is bright, but so is a blown-out window in the photograph. The distinguishing test is warmth: the surface is bright *and* warm *and* smooth, where daylight through a window is bright and cool. Getting this wrong made the crop grab the window and shift the rectangle, clipping people on the opposite edge.

Deskewing then creates diagonal margins that per-edge trimming cannot handle, so the crop finds the largest rectangle that fits entirely inside the print. When that safety fails it must return the original rather than the rotated image, because otherwise a sentinel-colored border leaks into the output. That fired on 28 of 207 images before I caught it.

Orientation had to move from a simple face detector to one that reports landmarks. The simple one has no confidence score and false-positives on rotated furniture, once confidently choosing 270 degrees on a photo that was upside down. Face *count* ties across rotations and tells you nothing; the decisive signal is landmark geometry, because eyes above mouth and eyes level only fits one rotation.

The upscaler was **removed** from the face restoration path, which is counterintuitive. It amplifies the stipple texture of the print surface into distinctive ring and swirl artifacts, so faces are restored and the background is smoothly resized with edge-preserving denoise instead.

Restoration also mutes color as a side effect, so the final blends the restored detail with the original scan's color rather than accepting the desaturated result.

Two operational traps cost real photos. File collection has to be **case-insensitive**: a glob for lowercase extensions silently skipped 61 of 207 images in a mixed folder, and silently is the operative word. And batch output goes to a sibling directory, or the tool re-ingests its own outputs on the next run.

## Tradeoffs

Emitting two versions doubles the output and pushes one decision back to a human, which is the honest resolution of a problem where the automated answer is right most but not all of the time. Generative glare fill was tested and left out of the default path: it reconstructs objects convincingly and also hallucinates them, once adding a candle to a cup.

## Outcome

Runs unattended over a folder of hundreds. The lesson I would keep is procedural rather than technical: **spot-check a sample of batch output before trusting all of it.** Both worst bugs fired only on specific failure paths, and neither appeared on the single image I tuned against.
