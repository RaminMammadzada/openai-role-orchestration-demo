# Sample For Another Team

Small orchestration demo built with the OpenAI SDK and OpenAI Agents SDK.

It takes markdown requirements, turns them into a structured requirement packet, generates a Product Owner brief, generates a Developer plan, and can optionally run a final review pass.

## Main Files

- `requirements/` holds the source product requirements and todo items.
- `src/engine/orchestrationEngine.ts` runs the workflow.
- `src/agents/` defines the Product Owner, Developer, and Reviewer agents.
- `docs/how-the-system-works.md` explains the architecture in more detail.

## Run

Set `OPENAI_API_KEY` in `.env`, then run:

```bash
npm install
npm run run:async
npm run run:developer
npm run run:sync
```
