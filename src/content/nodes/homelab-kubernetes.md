---
title: Homelab Kubernetes
tagline: Five years of running a real cluster at home; it became the career.
scale: 4
status: retired
domain: infra
tags: [home-automation, media, workflows]
started: 2020-10-24
ended: 2025-02-05
links: [box-stack, ynab-automation]
tech: [kubernetes, k3s, terraform, helm, argocd, cloudflare, digitalocean]
featured: 5
---

## Problem

I wanted to actually understand Kubernetes, and reading about it was not producing understanding. The only way I know to learn an operational system is to be the one who gets paged when it breaks.

## Constraints

It had to host things my household genuinely relied on, because a cluster with no real users teaches you nothing about failure. That meant password management, photos, media, DNS for the whole house, and later a friend's site and our budget tooling. Downtime had a human cost, which was the point.

## Approach

Three eras. A 2020-21 bare-metal homelab managed with Terraform and Helm; a 2021 hand-rolled AWS EKS and VPC sandbox; then a 2023-25 K3s rebuild on cloud instances with ArgoCD reconciling from git and External Secrets pulling from a vault.

I used a remote encrypted Terraform state backend on the hobby cluster from the first month, years before it was my job to care. The discipline is cheaper to build when the stakes are low.

## Edge cases considered

Not everything belongs behind the ingress. I spent weeks trying to reverse-proxy a media server through nginx before concluding it was the wrong shape for the traffic, backed it out, and pinned it to a beefier node with a node selector instead. The commit sequence reads as a small argument I had with myself and lost.

Backups fail silently in the one way that matters: they keep succeeding while producing nothing. The database backup script checks the dump's size before uploading, so an unreachable database cannot quietly overwrite a good backup with an empty one. That guard is four lines and is the single most valuable thing in the repository.

Observability had to justify its own cost. I ran a commercial agent for eleven days, measured what it cost against what it told me on a cluster this size, and removed it.

## Tradeoffs

I lost a full dual-stack networking fight and shipped the surrender. The commit log runs "forget ipv6?", then "forget everything v6", then "just fucking forget it", and then, an hour later, "re-add v6". Leaving that in is deliberate. The useful part of the record is not that I eventually got it working, it is that I timeboxed a rabbit hole, took the loss, and came back to it once the rest was stable.

Building the AWS network by hand rather than using the well-maintained module was slower and worse than the module. It was also the only way I was ever going to learn what the module does.

## Outcome

Ran for five years and served real users beyond me: a friend's site, household services, DNS for the home network, and a set of scheduled jobs importing bank transactions into our budget. Retired in early 2025 when the workloads consolidated onto a single orchestrated box, which cut the bill by roughly an order of magnitude for a fleet this size.

The last three commits are deletions of the finance importers as the cluster wound down. This is where the DevOps career came from.
