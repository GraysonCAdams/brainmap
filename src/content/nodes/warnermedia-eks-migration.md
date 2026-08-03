---
title: Live Streaming to EKS
tagline: Migrating an entire production streaming workload onto managed Kubernetes.
scale: 4
org: WarnerMedia
status: retired
domain: platform
started: 2019-06-01
ended: 2021-07-01
links: [homelab-kubernetes, warnermedia-telemetry]
tech: [kubernetes, eks, aws, terraform, docker]
---

## Problem

The production workload behind live streaming platforms ran on a self-managed Kubernetes distribution, and the operational cost of that choice was being paid continuously by the team rather than the platform.

## Constraints

Live streaming has no maintenance window that matters. The audience is largest exactly when the event is happening, which means the migration had to be invisible and reversible at every step.

## Approach

Move the production workload onto managed Kubernetes incrementally, alongside converting a large estate of hand-created cloud resources into infrastructure as code. Those two efforts reinforced each other: you cannot confidently move what you cannot reproducibly describe.

## Edge cases considered

Adopting existing resources into code is the hard direction. Writing new infrastructure declaratively is easy; describing a hundred resources that already exist, in a way that produces no changes on the first apply, is where the real work is. A plan that wants to recreate a live database is the thing you are trying to never see.

Autoscaling node pools also change the failure model rather than removing it. Scaling handles load, and creates a new class of problem around what happens to work in flight when a node goes away.

## Tradeoffs

Managed Kubernetes trades control for operational relief, and that trade is only worth it if you actually stop doing the work it takes over. Teams that keep operating the managed thing as though it were self-managed pay both costs.

## Outcome

Co-managed the migration of the production workload for live streaming platforms onto managed Kubernetes, with over a hundred previously hand-created cloud resources brought under infrastructure as code. This is also where the homelab stopped being a hobby and started being the reason I could do the job.
