---
title: Pipeline Security
tagline: Making the pipeline the place insecure code stops.
scale: 3
status: building
domain: security
tags: [workflows, infra]
started: 2024-10-01
links: [harris-terraform-platform]
tech: [ci-cd, kubernetes, istio, rbac]
---

## Problem

Security controls that live in a review step get skipped under deadline pressure, and controls that live in documentation are not controls. The only ones that hold are the ones a delivery path cannot route around.

## Constraints

A regulated firm, so the requirement is real rather than aspirational. But a gate that blocks constantly and inaccurately gets disabled within a quarter, whatever the policy says, so the accuracy of the check matters as much as its existence.

## Approach

Put scanning inside the delivery path so insecure code and containers fail there rather than in a meeting. Pair that with runtime controls: pod security policies, role-based access, and service-mesh network controls, so that something slipping through the build still lands somewhere constrained.

Rebuild the pipelines themselves with templating and conditional logic, so teams can define their own environments, approvals, and pre- and post-deploy steps within a shape that stays reviewable.

## Edge cases considered

The hard part of a blocking gate is what happens on a finding you cannot fix today, in a dependency you do not control, on the day of a release. Without a deliberate exception path that is time-bound and visible, teams will invent an undocumented one, and you will have traded a known risk for an invisible one.

Defense in depth is also a claim that needs testing rather than assuming. Build-time scanning and runtime policy protect against different things, and it is worth knowing which one is actually carrying a given scenario.

## Tradeoffs

Every gate is latency on the path to production, and latency to production has its own safety cost, because it encourages larger and riskier batches. Giving teams real customization within a reviewable structure was the compromise: flexible enough to be used honestly, constrained enough to be audited.

## Outcome

Security scanning embedded in delivery, runtime controls enforced at the cluster, and pipelines that teams can shape to their own workflow without stepping outside the guardrails.
