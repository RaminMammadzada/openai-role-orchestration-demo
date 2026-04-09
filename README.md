# OpenAI Role Orchestration Demo

Small role-based orchestration demo built with the OpenAI SDK and the OpenAI Agents SDK.

The project turns markdown requirements into structured workflow artifacts and coordinates three roles:

- Product Owner
- Developer
- Reviewer

## What It Does

The runtime reads requirement files from `requirements/`, normalizes them into a strict schema, and then runs a staged workflow:

1. Convert raw requirement markdown into a `RequirementPacket`.
2. Ask the Product Owner agent to create a developer-ready brief.
3. Ask the Developer agent to produce an implementation plan.
4. Optionally ask the Reviewer agent to validate the plan against the brief.
5. In delivery mode, ask a Developer Implementation agent to generate a file bundle and write it into the target workspace in `~/Downloads`.

This gives you a simple example of async, sync, and delivery orchestration with structured outputs between agent stages.

## Architecture

- `src/lib/openai.ts` uses the base OpenAI SDK for requirement normalization.
- `src/agents/` defines the Product Owner, Developer, Reviewer, and Developer Implementation agents.
- `src/engine/orchestrationEngine.ts` coordinates the workflow, session state, and saved artifacts.
- `.runs/` stores generated requirement packets, briefs, plans, reviews, and implementation bundles.
- `docs/how-the-system-works.md` explains the runtime in more detail.

## Run

Set `OPENAI_API_KEY` in `.env`, then run:

```bash
npm install
npm run run:async
npm run run:developer
npm run run:sync
npm run run:deliver
```

## Notes

- `run:async` stops after the Product Owner brief is created.
- `run:developer` resumes from the latest saved brief.
- `run:sync` runs the full Product Owner -> Developer -> Reviewer loop.
- `run:deliver` runs the full workflow and writes the generated project into the resolved `target_workspace`.
- The runtime retries on OpenAI rate limits; on low-RPM accounts a sync run may pause briefly before continuing.
- `.runs/latest/` is rewritten only when a command completes. It is a clean snapshot of the last completed `async`, `developer`, `sync`, or `deliver` run, so stale artifacts from earlier modes are removed.
