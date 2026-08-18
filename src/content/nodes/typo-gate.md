---
title: Typo Gate
tagline: Blocks the space bar on a misspelled word, because my typos are a motor problem, not a spelling one.
scale: 3
status: shipped
domain: tools
tags: []
started: 2026-06-14
links: []
tech: [swift, csharp, dotnet]
---

## Problem

A measured look at 2,322 of my own typed prompts found that my dominant error isn't misspelling, it's timing: the space lands one keystroke early and splits a correct word in two, "we wil lneed" instead of "we will need". That's a motor problem, and autocorrect or a squiggly underline after the fact doesn't fix a motor problem. What fixes it is refusing to let the space through until the word in front of it is real.

## Constraints

macOS and Windows have no shared input layer, so this had to be two native apps, not a port of one to the other. Neither can draw an inline red squiggle under the word the way a text editor's own view can; an external process watching the system doesn't get access to a terminal's text rendering that way. And on Windows, a keyboard hook callback that calls into UI Automation risks running long enough that the OS silently removes the hook, with no error to say it happened.

## Approach

Both apps hook keystrokes at the OS level, before any app sees them: a CGEventTap on macOS, WH_KEYBOARD_LL on Windows. A shadow buffer tracks the word currently under the cursor, built up character by character and popped on backspace. Only space and return count as word boundaries; everything else, periods, slashes, colons, digits, just extends the token, so URLs and file paths and decimals type freely. When a completed word doesn't check out, the space keydown gets swallowed instead of passed through. macOS surfaces a draggable popover instead of an inline squiggle, and Windows shows a small overlay sized to the DPI of whichever monitor the caret is currently on.

## Edge cases considered

Apostrophes broke first. A three-character minimum length got applied at dictionary load time in the Windows build, not just at check time, which quietly dropped every two-letter stem the dictionary needed: is, do, it, he, we, ca. Those are exactly the stems the contraction rules look up, so every contraction like "shan't" read as a typo until the load floor and the check floor were separated.

The keystroke buffer is a model, and models drift from what's actually on screen. I type around 250 words a minute, so any assumption that a screen read will land before the next keystroke does is false on its face. The fix was to stop trusting the buffer's memory of state and instead reconcile against the rendered text, undoing a block if the screen disagreed with the buffer.

Windows had its own private hell of silent failures. `SendInput` needs `MOUSEINPUT` included in its union or the struct size comes out 32 bytes instead of 40 on 64-bit, and the call fails by returning 0 with no exception, so keystrokes just never arrive. A tool window with `WS_EX_NOACTIVATE` and managed `TopMost` can report itself visible while rendering nowhere, needing an explicit `SetWindowPos` call to actually show. And a screenshot taken to verify the overlay is on screen has to call `SetProcessDPIAware` first, or a capture on a 200%-scaled display photographs the wrong region entirely and reports the window as absent when it isn't.

Even the rejection path had a gap: for the roughly 70 to 90 milliseconds it takes to re-read the word off the screen after a block, the buffer sits empty, and an empty buffer waves a space through. Fast enough mashing of the space bar could land inside that window and beat the gate.

## Tradeoffs

No inline squiggle on either platform was the one visual concession I couldn't get around, given that an external process can't reach into another app's text rendering. The two "let it through anyway" gestures also had to diverge by platform for the same reason: Shift+Space on macOS, a second and a half hold on Windows. There's no gesture that means the same thing on both, any more than there's one hook.

## Outcome

Both apps run at login, macOS as a menu-bar app and Windows as a tray app, neither packaged as a background service so each can still reach an interactive desktop session. All dictionaries are compiled in locally; nothing calls out to the network.
