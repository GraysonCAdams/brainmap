---
title: Box Stack
tagline: A cloud fleet's worth of personal apps, consolidated onto one orchestrated server.
scale: 4
status: shipped
domain: infra
tags: [utilities]
started: 2026-07-10
links: []
tech: [nomad, docker, cloudflare-tunnel]
---

## Problem

A personal fleet of about sixteen always-on applications had spread across a cloud platform at roughly $88 a month, and the cost was the least of it. The apps had no shared operational story: no common backup, no common ingress, no single place to see what was running.

## Constraints

One machine had to hold all of it without a runaway app taking down the rest. The migration had to be reversible at each step, since these are services my household actually uses. And I wanted to stop paying for idle capacity across sixteen separate always-on allocations.

## Approach

Everything onto a single well-specified server, with a hard memory and CPU limit declared per container so a runaway hits its own limit rather than the host. Ingress through one tunnel over a shared network, so nothing needs a public port. Hourly snapshot backups to separate storage, with a restore path I actually tested rather than assumed.

Migration ran as a wave of parallel jobs, one to move each app and one to independently validate it, rather than moving things by hand and hoping.

## Edge cases considered

A mutable image tag is a silent failure. The orchestrator will not re-pull a tag it has already seen, so a deploy reports success while the previous build keeps running. Every job now pins an immutable digest. This is the kind of bug that does not announce itself; it just means the fix you shipped is not the code that is live.

Network membership had to become declarative. Attaching a container to the ingress network by hand works immediately and is silently discarded the next time that container is recreated. It bit me three times, and once left the ingress path itself one recreate away from taking every public app down. It is now a rule that must be declared in the job spec, never a live command.

Rollback is not symmetric with deploy once a schema has moved. The auto-updater restores previous image digests on a failed health check but deliberately does **not** restore the database, because an older binary against a migrated-forward schema is a new failure mode rather than a recovery. The snapshot stays as a manual aid, with a human deciding.

Migrating a live SQLite database meant copying the write-ahead log files as one atomic set while the source was still running, since the source images had no database CLI to take a proper backup. Copying just the main file would have lost recent writes silently.

The backup set had a hole shaped like itself: it covered application state but not the scripts and timers that perform the backups. Losing the disk would have destroyed the only copy of the recovery tooling.

## Tradeoffs

One box is one failure domain, and I chose that on purpose. The mitigation is frequent backups to separate storage plus a tested restore, not architectural redundancy, because the honest failure budget for personal services does not justify the second machine.

I also ended up with two orchestrators rather than one clean design. The ingress-critical services stayed on the simpler runtime because they resisted conversion and the conversion had no upside worth an outage. Accepting an ugly split beat forcing elegance onto the one component whose failure takes everything else with it.

## Outcome

Fifteen applications migrated, the old fleet's run rate reduced by roughly 98%, and a single place to see what is running. The follow-on consequence is that the local image cache is now the only copy, so updates are build-from-source per repository rather than registry pulls, which is a real ongoing cost I traded for.
