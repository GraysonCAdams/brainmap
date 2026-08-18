---
title: VHS Restoration Pipeline
tagline: A local pipeline for decades of family tape, which found out the hard way what happens when you trust the wrong timestamp.
scale: 3
status: shipped
domain: media
started: 2026-05-01 # UNVERIFIED: the restoration effort's own repo starts 2026-06-29.
  # May is the earlier cloud-upscaling attempt this replaced. Correct me.
links: []
tech: [ffmpeg, topaz, syncnet, exiftool, python]
---

## Problem

Family tapes from the 1980s and 90s digitize into files that are technically watchable and genuinely unpleasant: interlaced, noisy, soft, with junk at the frame edges, audio that drifts out of sync with the picture, and no metadata beyond a filename.

## Constraints

Entirely local, no cloud. These are family recordings and I am not uploading them anywhere to be processed. Output has to import cleanly into consumer photo and media libraries, which means the metadata matters as much as the picture.

Topaz Video AI's bundled ffmpeg has no libx264, so encoding goes through Apple's hardware encoder instead. MPEG-2 captures often carry sparse timestamps, one tape had them on 31,346 of 32,032 frames and another on only 349 of 428, which leaves a deinterlacer free to build a corrupted timeline if the pipeline trusts the container's stated duration over the actual frame count. A single M3 Pro has one GPU and five performance cores, so running every stage at once oversubscribes both and finishes slower than doing less concurrently.

## Approach

Ordered stages: deinterlace and crop on the CPU, upscale through Topaz's Proteus #4 model on the GPU, then motion interpolation, color grade and audio, then verify and stamp metadata.

The ordering is not arbitrary. Motion interpolation has to come after the upscale, because running it first produces a watercolor smear as the interpolator invents motion from noise the upscaler had not yet cleaned up. Topaz gets a clean, unprocessed input for the same reason.

A GPU job and a CPU job are allowed to overlap, one of each at a time, coordinated through atomic mkdir-based locks with stale-PID cleanup. That is as far as the parallelism goes before it costs more than it saves.

## Edge cases considered

Deinterlace parity is per-tape and getting it wrong ruins the result invisibly. One tape is top-field-first and the next is bottom-field-first, and the wrong choice produces motion that judders in a way you notice only on a moving subject. Crop values are per-tape too, since each has its own edge artifacts from the capture head.

Dropped-frame detection did real damage before I caught it. mpdecimate was meant to strip VHS padding, frames the tape itself duplicates, but it cannot tell padding apart from a camera genuinely held still on a subject, and on static-heavy footage it deleted frames that were never duplicates. One tape lost 29% of its length that way and another lost 7%, silently, because the filter trimmed the audio to match with `-shortest` so the output stayed in sync and looked correct right up until someone noticed it was minutes shorter than the source. mpdecimate is disabled now, and motion smoothing runs through minterpolate alone, which duplicates frames on static footage instead of deleting anything.

Timeline corruption was a separate failure with its own signature. One tape's container reported 14.76 seconds of audio while the video stream actually ran 54.75 seconds, because the deinterlacer had nothing but sparse timestamps to build a timeline from and built the wrong one. Rebuilding PTS from the actual frame count is the default for every tape now rather than a fallback reached for when something looks wrong, since the failure mode of trusting a bad timeline is worse than rebuilding one that did not need it. There is a trap inside the check that decides this: frames often do not all carry a timestamp, so computing rate from timestamped packets alone reads falsely slow and sends you chasing a problem that does not exist.

Lip-sync measurement needed a rule I learned by getting it wrong. A coarse probe at evenly spaced intervals out to sixteen minutes found zero usable face tracks on one tape, because the one clearly talking segment fell at six minutes ten seconds, between probe points. Candidate windows are now ranked by audio energy first and face detection runs only on the loudest ones, which finds the segment a blind grid search walks past. Footage with no talking faces at all falls back to structural duration matching instead.

Metadata is what makes the result usable rather than just archived. Filenames carry the only date information that exists, so a resolver parses them and applies manual travel or event overrides where needed. Timestamps also need a timezone offset that respects daylight saving for the date in question, or a consumer photo library files a summer memory in the wrong month.

## Tradeoffs

Topaz runs one manually tuned preset across every tape rather than auto-estimating per frame. Auto-estimation is more accurate to any given tape and less consistent from one tape to the next; a fixed preset is a little worse on the outliers and reproducible on everything else.

Keeping GPU and CPU work overlapped two deep, and no deeper, buys roughly 1.7 to 1.8 times the throughput of running everything sequentially. A third concurrent stage was tried and made things slower, since the CPU-bound motion-fill stage was already splitting five performance cores as many ways as it could use productively.

Interpolating motion is also inventing frames that were never shot. For home video I think that is the right call, since the alternative is judder that constantly reminds you that you are watching a recording rather than a memory.

## Outcome

Tapes from 1985 through 1991 have gone through the pipeline, two fully restored and the rest queued, each one verified for audio sync and stamped so it lands in the right place on a family timeline. End to end it runs roughly three times the footage length.

The PTS rebuild default and the removal of mpdecimate were both responses to real, previously silent data loss, and the SyncNet verification step exists so that a future failure of either kind gets caught before a tape is called finished rather than after.
