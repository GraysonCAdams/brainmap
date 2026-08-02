---
title: Sandbroker
tagline: Agents can use my secrets but can never see them.
scale: 4
status: building
domain: security
tags: [ai-tooling]
started: 2026-07-20
links: [mcp-gateway]
tech: [go, biometrics, sandboxing]
featured: 4
---

## Problem

Agents need real credentials to do useful work, and every ordinary way of giving them one also creates a way for the value to escape: into the model's context, into the request body, into a session transcript, into a prompt cache. The usual mitigation is a redaction filter over the output, which fails open the moment a value appears in an encoding the pattern did not anticipate.

## Constraints

The guarantee had to hold by construction rather than by filtering. Routine development work had to stay frictionless, or I would route around my own tool. Anything touching production had to require a human, but not so often that the human starts approving reflexively.

## Approach

The agent never asks for a secret. It submits an intent: a verb plus a reference. The daemon resolves the value, injects it into a child process, runs the action, and hands back the result. For a one-way action that result is a boolean.

Three details do the actual work. The child's output goes to `/dev/null` at the file-descriptor level, so it cannot talk back to the caller. Secrets are never passed as arguments, because the process table is readable by the same user. And verbs are pinned to a specific host and path, so an agent cannot redirect a credential at a destination of its choosing, which would be an exfiltration channel wearing a verb's clothes.

## Edge cases considered

Reads looked structurally impossible at first. Most real work needs the queried data back, not just a success signal, and the whole design is built on discarding what the child says. The resolution was to stop treating the channel as the control point: a privileged wrapper performs the operation in its own memory and writes only explicitly enumerated non-secret fields to a path matched against a fixed pattern, which the agent then reads under its own identity. "The channel carries nothing" became "the wrapper decides the shape of what comes out."

An empty result and a failed resolve were originally indistinguishable, because suppressing everything suppressed the difference too. Splitting those into two states required care, since neither error message may carry the reference or the value.

The one-vault-per-session model turned out not to match how I actually work. A session legitimately needs development, production, and cross-cutting infrastructure credentials open at once. Bindings now stack like sudo elevations and expire independently on idle, and an unrecognized alias is denied before any backend call happens.

The hardening applied to the daemon collided with the daemon's own needs: a systemd restriction on setgid blocked it from creating the directory its approval flow depends on. Security controls interfering with each other is a category of bug I now look for first.

## Tradeoffs

Every new integration needs a human to author a pinned verb. There is deliberately no generic "give me a secret" escape hatch, because an escape hatch is the whole attack. That friction is the security model working rather than a gap in it.

I also do not claim this is unbreakable. The guarantee covers the channels this thing mediates, and it is worth nothing if a parallel path to the same credential exists. I found exactly that during review: a separate integration had a token sitting in a world-readable config, which would have made the whole design decorative.

## Outcome

Public, MIT licensed, on PyPI, with the core property asserted by an executable test suite rather than a claim in a README.

The most valuable lesson came from a latent bug in that suite. Secret injection into standard input had never worked: a formatting call was consuming the placeholder before substitution, so children received the literal placeholder text. Every test passed, because every test asserted that nothing leaked, and nothing leaking is trivially true when nothing was injected. The fix was to add tests whose success **requires** the value to arrive. Testing that a secret does not appear proves very little on its own.
