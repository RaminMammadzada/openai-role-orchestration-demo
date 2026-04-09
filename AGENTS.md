# Team Agents

Always use the OpenAI developer documentation MCP server if you need to work with the OpenAI API, ChatGPT Apps SDK, Codex, or Codex skills without being explicitly told to do so.

This repository defines two collaborating Codex roles:

- Product Owner agent: use `$product-owner` and load `agents/product-owner.md`.
- Developer agent: use `$developer` and load `agents/developer.md`.

## Default Operating Model

Use the Product Owner agent first when the work is ambiguous, under-specified, or missing acceptance criteria. Use the Developer agent first when the work is already clearly scoped and ready for implementation.

The Product Owner agent owns:

- problem framing
- success metrics
- scope control
- acceptance criteria
- release readiness review

The Developer agent owns:

- technical design
- implementation
- test coverage
- validation
- delivery notes

## Asynchronous Collaboration

When the agents work asynchronously:

1. Product Owner produces a task brief with goal, context, constraints, risks, acceptance criteria, and definition of done.
2. Developer implements against that brief, records assumptions, runs validation, and returns a delivery note with any gaps.
3. Product Owner reviews the result against the original acceptance criteria and either accepts it or issues a follow-up brief.

## Synchronous Collaboration

When the agents work synchronously in the same thread or session:

1. Product Owner clarifies scope and negotiates tradeoffs in real time.
2. Developer proposes implementation details, surfaces blockers quickly, and asks for decisions only when needed.
3. Product Owner resolves open questions immediately and confirms when the increment meets the acceptance criteria.

## Required Handoff Format

Use this structure for any handoff between the two roles:

```md
Goal:
Context:
Constraints:
Acceptance Criteria:
Validation:
Open Questions:
```

## Routing Rules

- If a request includes prioritization, backlog shaping, user stories, release notes, stakeholder alignment, or acceptance criteria, route to the Product Owner agent.
- If a request includes coding, refactoring, debugging, testing, migration, or verification, route to the Developer agent.
- If a request spans both, the Product Owner agent should define the work package first, then the Developer agent should execute it.

## Completion Rules

- Product Owner outputs should be concise, decision-oriented, and testable.
- Developer outputs should include concrete changes, validation status, and residual risks.
- Both roles should keep the other role informed in terms that are easy to act on immediately.