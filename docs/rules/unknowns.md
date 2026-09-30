# Physical rules: evidence and missing configuration

Source: the product owner's One Chance Mobile brief in this project's founding conversation. No physical rulebook edition, board, or card scans have been supplied.

Confirmed facts only:

- The game begins with JAMB; a roll of 4, 5, or 6 passes JAMB.
- Salary, traffic, prison, tax, Ajo, bank investment, and market investment exist.
- One Chance cards may have positive or negative outcomes; there are 32 physical cards.
- Multiple players participate; wealth accumulation and financial decisions matter.

Unknown and unconfigured:

- Starting cash, currency scale, setup, player limits, turn order, initial positions.
- Dice specification, retry/failure handling, and what follows successful JAMB.
- Board topology, location order/content, pass/landing triggers, movement details.
- Every amount, timing condition, eligibility rule, duration, and interaction for the named mechanics.
- All 32 card definitions, duplicates, draw/discard/reshuffle/retention rules.
- Loans, debt, bankruptcy, rounding, insufficient funds, and bank supply.
- Victory, valuation, ties, elimination, match end, conflict precedence.

There is no production ruleset in Phase 1. `RuleKnowledge<T>` explicitly represents unknown values as null and requires evidence for confirmed values. Nothing in diagnostic geometry, screen labels, or tooling establishes a physical game rule.

The approved UI capacity of 2–6 players is a layout requirement, not evidence of legal physical player limits.
