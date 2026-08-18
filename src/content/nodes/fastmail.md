---
title: Fastmail Contact Sync
tagline: A small daemon that turns inbox activity into contacts, and screened-out senders into a do-not-contact group.
scale: 1
status: retired
domain: tools
tags: []
started: 2025-09-01 # UNVERIFIED: the archive carries no dates at all. Inferred only
  # from sitting before imap-watcher (2025-10-02), which supersedes it. Correct me.
links: [imap-watcher]
tech: [python, imap, carddav, sqlite]
---

## Problem

Fastmail didn't build contacts out of the mail I actually received; anyone new stayed unentered until I added them by hand. Separately, a message from an unknown sender that got screened into the Screened Out folder just sat there. Nothing recorded that decision anywhere a mail client could act on it later.

## Constraints

IMAP polling was the only option available; Fastmail didn't offer anything closer to push for this. Whatever I built also had to survive its own restarts without re-processing the whole mailbox, so it needed to remember which messages it had already seen.

## Approach

A daemon polls the Inbox and the Screener folder on an interval, pulls the sender off each new message, and checks the CardDAV address book for an existing contact. If there isn't one, it builds a vCard and creates it. When a message moves from Screener into Screened Out, the daemon also adds that sender to a dedicated group instead of just leaving the filing decision inside the mail folder.

## Edge cases considered

Folder detection is keyed to the Screener and Screened Out folder names specifically, so reorganizing that part of the account breaks the sync without any error surfacing. There's no deduplication either: the same person emailing from two addresses becomes two separate contacts, since the matching is address-based with no secondary identity check.

## Tradeoffs

I said as much in my own README: this needed reconnect logic, backoff, and sturdier XML parsing before I'd call it production-grade, and none of that got built. Polling instead of something event-driven was the simpler path and it's the one I took, latency and all. The CardDAV response parsing assumes a specific server shape, so a change on Fastmail's end could break it silently rather than loudly.

## Outcome

It did the job it was written for. There's no commit history to point to, which tells its own story: a script written to fix one specific annoyance and then left alone, not a project I kept coming back to.
