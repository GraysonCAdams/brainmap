---
title: VHS Restoration Pipeline
tagline: Decades of family tape, restored to something worth watching.
scale: 3
status: shipped
domain: media
tags: [workflows]
started: 2026-05-01
links: []
tech: [ffmpeg, topaz, syncnet, exiftool]
---

## Problem

Family tapes digitize into files that are technically watchable and genuinely unpleasant: interlaced, noisy, soft, with junk at the frame edges and audio that drifts out of sync with the picture.

## Constraints

Entirely local, no cloud. These are family recordings and I am not uploading them anywhere to be processed. Output has to import cleanly into consumer photo and media libraries, which means the metadata matters as much as the picture.

## Approach

Four stages, deliberately ordered. Deinterlace and crop first. Upscale second. Motion interpolation, color grade, and audio third. Verify and stamp metadata last.

Stage ordering is not arbitrary: **motion interpolation must come after the upscale.** Running it before produces a watercolor smear, because the interpolator is inventing motion from noise the upscaler had not yet cleaned up.

## Edge cases considered

**Deinterlace parity is per-tape and getting it wrong ruins the result invisibly.** One tape is top-field-first and the next is bottom-field-first, and the wrong choice produces motion that judders in a way you notice only on a moving subject. Crop values are per-tape too, since each has its own edge artifacts from the capture head.

The most valuable rule concerns rebuilding the timeline. A frame-index rebuild fixes a source whose timestamps are corrupt, and **silently desynchronizes audio** on a source with genuine dropped-frame gaps. So the pipeline checks first by comparing the decoded frame count against the container duration, and branches. There is a trap inside that check: frames often do not all carry a timestamp, so computing rate from timestamped packets alone reads falsely slow and sends you chasing a problem that does not exist.

Lip-sync measurement needed a rule I learned by getting it wrong. Do not measure on blind fixed time windows. Scan for a segment where someone is clearly facing the camera and speaking, and measure on **that**. A coarse probe at regular intervals missed the one clear talking segment on a tape entirely, and measuring on footage with no faces produces confident nonsense. Footage with no talking faces at all falls back to structural duration matching instead.

Metadata is what makes the result usable rather than just archived. Timestamps need a timezone offset that respects daylight saving for the date in question, or consumer photo libraries file a summer memory in the wrong month.

## Tradeoffs

The upscale settings are one tuned preset rather than a per-tape optimization. Better results are available per tape at a cost in time I would rather spend restoring more tapes.

Interpolating motion is also inventing frames that were never shot. For home video I think that is the right call, since the alternative is judder that constantly reminds you that you are watching a recording rather than a memory.

## Outcome

An established process, several tapes restored, each one verified for audio sync and stamped so it lands in the right place on a family timeline. Runs roughly three times the footage length end to end.
