---
title: Terraform Platform
tagline: Cut infrastructure deployment from five days to under ten minutes.
scale: 4
status: building
domain: infra
tags: [workflows]
started: 2024-09-01
links: [harris-pipeline-security, homelab-kubernetes]
tech: [terraform, kubernetes, azure, databricks]
featured: 1
---

## Problem

Standing up infrastructure for a new application took about five days of specialist time. That cost is not mainly the waiting; it is that a five-day turnaround changes what teams are willing to attempt. Anything exploratory stops being worth asking for.

## Constraints

Regulated environment, real trading systems, and multiple teams with genuinely different needs. A platform that only fits the average case gets abandoned by everyone at the edges.

## Approach

Modularize into reusable patterns rather than templates to copy. The distinction matters: a copied template diverges immediately and every consumer maintains their own fork, while a module keeps improvements flowing to everyone who adopted it.

Then standardize how applications actually get deployed across the common shapes, so a team choosing between a long-running service, a stateful workload, and a scheduled job is choosing between supported options rather than inventing one.

## Edge cases considered

The failure mode for a platform team is building something that is only usable by the platform team. Adoption is the honest measure, so the design question is always what the least-context team will do when they hit the first thing the module does not cover, and whether that path leads back to the platform or away from it.

Being the standard also means every rough edge is now everyone's rough edge simultaneously. That raises the bar on changes considerably, because the blast radius of a mistake scales with how successful you have been.

## Tradeoffs

Reusable patterns constrain what teams can express, and some of those constraints will be wrong for somebody. The exchange is that the ninety percent case becomes nearly free. Getting that boundary right, rather than getting the modules right, is the actual work.

## Outcome

**Deployment time went from about five days to under ten minutes**, with the patterns adopted by more than eight production applications across trading and enterprise environments, and an automated deployment and testing path for analytics workloads rolled out firm-wide in partnership with quantitative leadership.
