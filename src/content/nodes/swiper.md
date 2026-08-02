---
title: Swiper
tagline: Swipe a line to indent it, on a phone.
scale: 1
status: shipped
domain: utilities
started: 2025-10-30
links: [block-select]
tech: [typescript, obsidian, ios]
---

## Problem

Outlining on a phone means indenting and dedenting constantly, and the touch keyboard makes that genuinely painful. The gesture I wanted did not exist.

## Constraints

Phone only, since the problem does not exist with a keyboard. It had to not interfere with the gestures the editor already uses, which is a narrow space to work in.

## Approach

Swipe right on a line to indent, left to dedent.

## Edge cases considered

The threshold is the entire product. Too sensitive and scrolling reorganizes the document; too insensitive and it feels broken. There is no correct value derivable from first principles, only one found by using it and being annoyed.

Dedenting at the outermost level also has to do nothing gracefully rather than error, because a gesture that fails visibly on a no-op feels like a bug.

## Tradeoffs

Single-platform by design. Making it work everywhere would mean handling gestures on hardware where the problem does not exist, for no benefit.

## Outcome

Two-line description, and I use it constantly. The best small tools are the ones that make a specific irritation stop.
