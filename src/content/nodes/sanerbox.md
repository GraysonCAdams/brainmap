---
title: Sanerbox
tagline: An email triage agent that learns filing rules from corrections, and refuses to hide judgment calls in a folder.
scale: 3
status: shipped
domain: tools
tags: [ai-tooling]
started: 2026-03-17
links: [imap-watcher]
tech: [go, jmap, sqlite, nomad, docker]
---

## Problem

My Fastmail folder scheme was shallow and it was hiding mail. In about two weeks it let 130 unread messages pile up outside the Inbox, including 26 unpaid bills and 71 emails where an actual person was waiting on an answer. Filing is destructive to attention: a folder's contents are invisible until you deliberately open it, so the more a system auto-files for you, the more it can hide.

## Constraints

I did not want a mailbox where auto-filed things silently vanish, and I did not want another layer of manual filter rules that only I could see the shape of. Retiring a folder had to be done completely: removing it from the code's list of managed folders and from the database mapping both, because leaving either behind meant the app would just recreate the folder at the next startup. And a classification I was not confident about could not just get filed anyway; low-confidence had to mean something.

## Approach

Classification runs in two tiers. Sender rules, learned from my own corrections, match fast and locally with no API call. Anything a rule does not confidently cover falls through to Claude, which handles the judgment calls and the mail that does not fit a pattern yet. A sender can also be pinned to the Inbox rather than a folder, which skips auto-filing but still sends the message to Claude for a needs-attention verdict, so a protected sender is not the same as an ignored one.

## Edge cases considered

Rule promotion required real thought. Dragging 900 emails to a folder in one motion is one decision, not 900, so a single bulk move can't train a rule by itself; the same correction has to show up in two separate poll cycles, spread over time, before it's trusted as a pattern. Correcting a sender that already has a rule is different and applies immediately, because there's no ambiguity left to protect against.

Inbox rules turned out to be a trap. Inbox has no row in the folder mapping table, since it's the implicit default, so a naive check for "does this folder still auto-file" would silently discard every rule that pins a sender to the Inbox, which are the most protective rules in the system. They needed their own path.

Retired folders are the same trap from the other direction. A rule trained under an old folder scheme keeps matching on sender even after its destination folder is gone. Honoring it anyway would skip the Claude tier and the needs-attention check and leave the message unflagged and untouched. So a rule only gets honored if its destination still auto-files; otherwise it falls through to Claude like there was no rule at all.

## Tradeoffs

New folders start with auto-filing off. A freshly discovered mailbox never begins swallowing mail unannounced, which means I have to opt a folder in by hand, and that's friction I chose on purpose. The bigger tradeoff is the one behind the whole design: I never added a "Review" or "Important" folder for uncertain mail, even though it would have been the easy answer. A folder like that just recreates the original problem, mail sitting invisible until I go looking. Flagging keeps uncertain mail in the Inbox where I can't avoid seeing it.

## Outcome

Running live, two-tier classification with a learned rule set and a promotion rule that resists mistraining from bulk moves. As of the last check it auto-files only into Receipts and Newsletters; everything else stays manual or gets flagged for a real decision.
