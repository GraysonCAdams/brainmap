---
title: On-Prem to Azure Migrations
tagline: Million-dollar migrations where the architecture and the budget were the same problem.
scale: 4
status: retired
domain: infra
started: 2021-07-01
ended: 2024-06-01
links: [att-legacy-containerization]
tech: [azure, kubernetes, terraform]
---

## Problem

Long-lived on-premises systems needed to move to the cloud, on budgets and timelines that were visible high in the organization. The technical design and the cost model were not separable questions.

## Constraints

High visibility means the cost of being wrong is partly political, which changes how you sequence work: you want the risky, uncertain parts early, when there is still room to change course.

## Approach

Design the target architecture against the actual requirements rather than a reference diagram, then migrate in an order that surfaces the unknowns first. Most of the value was in the requirements conversations, not the terraform.

## Edge cases considered

The requirement people state is rarely the requirement that binds. A system described as needing high availability often actually needs a specific recovery time, and those imply very different and very differently priced designs. Finding the binding constraint early is what keeps a migration from being redesigned halfway through.

Legacy systems also carry undocumented dependencies that only appear under load or at month end, which is a strong argument for moving during a boring part of the calendar.

## Tradeoffs

Cloud migrations are frequently sold as cost savings and frequently are not, at least not immediately. Being honest about that up front costs you enthusiasm early and buys you credibility later, which is the better trade on a multi-year program.

## Outcome

A series of high-visibility migrations delivered across three years, spanning architecture design, requirements, budget constraints, and the unglamorous troubleshooting that follows a cutover.
