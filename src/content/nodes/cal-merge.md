---
title: Calendar Merge
tagline: Many calendars in, one clean shared calendar out.
scale: 2
status: shipped
domain: utilities
tags: [workflows]
started: 2026-06-20
links: [box-stack]
tech: [python, caldav, nomad]
---

## Problem

My life is spread across seven calendars and the people I share plans with should see one. Work events need to be visible as busy without leaking what they are, and everything else should carry enough detail to be useful.

## Constraints

The work calendar's contents are not mine to share, so those events had to be anonymized down to a time block. The merge had to be idempotent, since it runs continuously and any drift compounds. And it had to recover from losing its own state without duplicating a year of events into the destination.

## Approach

Poll each source, diff against what the destination already has, and write only the difference. Events carry a marker so the service can recognize its own work on a calendar a human also edits directly. Work events sync as an anonymized busy block with description and location stripped.

## Edge cases considered

Two API parameters turned out to be mutually exclusive in a way nothing documented. Requesting a sort order silently prevents the incremental sync token from ever being issued, so every cycle fell back to a full resync while appearing to work. The diff never needed the ordering, so dropping it fixed a performance bug that had no visible symptom.

Timezone normalization broke change detection. The provider stores an inserted offset and returns it normalized to UTC, so a hash computed at write time and a hash computed at read time disagreed for about 110 recurring work events, making them look permanently changed. Canonicalizing to UTC before hashing fixed it. This is a general trap with any content hash over data that round-trips through a system that reserves the right to normalize it.

Recovering from state loss originally left every adopted event marked pending, which then forced a spurious update on all of them the next cycle. Recomputing the hash from the destination's actual current state made adoption a real no-op.

The source I care most about broke in the quietest possible way. The work calendar had been imported by URL, that URL's token rotated, and the provider kept politely polling a dead address for weeks without surfacing an error. Nothing alerted, because from the service's point of view the calendar was simply empty. It now fetches and expands the feed directly, and free, out-of-office, and cancelled entries are filtered before they reach the shared calendar.

Cutover had a specific hazard: events left by the previous ad-hoc script were invisible to a marker-based reconcile, so they had to be removed first or they would have persisted as permanent duplicates nothing owned.

## Tradeoffs

There is no queue and no database, just a small local state file plus the ability to rebuild from a scan of the destination. That is simpler to run and means correctness rests entirely on the reconcile being right, which is why most of the work went into verification rather than features: a dry run, an idempotency check, a deliberate state-loss recovery test, and a two-day parity run against a throwaway calendar before it was ever pointed at the real one.

Moving the configuration out of the image and onto the host was a small change with a large effect. Adding or removing a source no longer requires a rebuild.

## Outcome

Running continuously across seven sources. The migration that fixed the frozen work feed also had to purge over a thousand orphaned events left behind by the dead one, which is a good illustration of how long a silent failure can accumulate before anyone notices.
