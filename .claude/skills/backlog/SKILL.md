---
name: backlog
description: Print the Real Food Win project backlog of deferred questions, decisions, and tasks. Use when the user says "show me your backlog", "what's on the backlog", "print the backlog", or any equivalent request to view deferred items.
---

# Backlog skill

When invoked:

1. Read `.claude/backlog.md` from the project root (`/Users/robertdawson/u01/realfoodwin/.claude/backlog.md`).
2. Display its contents verbatim to the user. Do not summarize — they want the full list.
3. If the user asks to add an item, append it to the appropriate section in `.claude/backlog.md` with today's date.
4. If the user says an item is resolved, remove it from `.claude/backlog.md` (do not just strike it through).
5. If the user asks for a specific section (e.g., "show me just the billing items"), filter to that section.

The backlog file is the source of truth. Always read it fresh — do not rely on memory of prior contents.
