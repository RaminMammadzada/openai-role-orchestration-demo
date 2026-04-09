# How The System Works

This repository is a small orchestration runtime built around three stages:

1. Normalize raw requirements.
2. Create a Product Owner brief.
3. Create a Developer plan and optionally review it.

It uses both the OpenAI SDK and the OpenAI Agents SDK.

## High-Level Flow

```text
requirements/*.md
        |
        v
OpenAI SDK normalization
        |
        v
RequirementPacket
        |
        v
Product Owner agent
        |
        v
ProductOwnerBrief
        |
        v
Developer agent
        |
        v
DeveloperPlan
        |
        v
Reviewer agent (sync mode only)
        |
        v
ProductReview
```

## Main Pieces

### 1. CLI entry point

The command entry point is [src/cli.ts](/Users/derem/cloud/ai/sample_for_another_team/src/cli.ts#L1).

It supports three commands:

- `sync <requirements-file>`
- `async <requirements-file>`
- `developer <brief-json>`

`sync` runs the full flow.
`async` stops after the Product Owner brief is created.
`developer` resumes from an existing saved brief.

## 2. Requirement normalization

The normalization step lives in [src/lib/openai.ts](/Users/derem/cloud/ai/sample_for_another_team/src/lib/openai.ts#L13).

This step uses the base OpenAI SDK, not the Agents SDK.

Its job is to:

- read the main requirement markdown file
- read `requirements/todo.md` if it exists
- convert both into a strict `RequirementPacket`
- assign a default target folder in the user's `Downloads` directory

This is intentionally the first step because raw markdown is unstructured and may be incomplete. The runtime converts it into a predictable shape before handing it to any role agent.

## 3. Shared schemas

The structured outputs are defined in [src/schemas.ts](/Users/derem/cloud/ai/sample_for_another_team/src/schemas.ts#L1).

The system uses four schema types:

- `RequirementPacket`
- `ProductOwnerBrief`
- `DeveloperPlan`
- `ProductReview`

These schemas are important because they make each stage explicit and machine-readable. Instead of passing free-form text between agents, the system passes validated objects.

## 4. Prompt bundle

The prompt loader is in [src/prompts.ts](/Users/derem/cloud/ai/sample_for_another_team/src/prompts.ts#L1).

Before any agent runs, the runtime loads:

- the repo-level guide from `AGENTS.md`
- the Product Owner agent brief
- the Product Owner skill
- the Developer agent brief
- the Developer skill
- the orchestration research notes

This means the runtime does not hardcode all instructions in one file. It builds each role prompt from the repository documents you already created.

## 5. Role agents

The three role agents live here:

- [src/agents/productOwner.ts](/Users/derem/cloud/ai/sample_for_another_team/src/agents/productOwner.ts#L1)
- [src/agents/developer.ts](/Users/derem/cloud/ai/sample_for_another_team/src/agents/developer.ts#L1)
- [src/agents/reviewer.ts](/Users/derem/cloud/ai/sample_for_another_team/src/agents/reviewer.ts#L1)

Each agent:

- uses the Agents SDK `Agent` class
- receives shared repository guidance plus role-specific guidance
- gets a local `WorkflowContext`
- returns a structured output matching one schema

The roles are separated on purpose:

- Product Owner creates a developer-ready brief
- Developer creates an implementation plan
- Reviewer checks the Developer output against the Product Owner brief

## 6. Orchestration engine

The main coordinator is [src/engine/orchestrationEngine.ts](/Users/derem/cloud/ai/sample_for_another_team/src/engine/orchestrationEngine.ts#L19).

This class manages:

- run ids
- conversation creation
- agent sessions
- workflow mode
- persistence of results

### `runAsync`

`runAsync()` does this:

1. Load the requirement files.
2. Create a server-side OpenAI conversation.
3. Normalize the requirement into a `RequirementPacket`.
4. Run the Product Owner agent.
5. Save the result to `.runs/<run-id>/`.

This mode is for asynchronous handoff. It prepares a brief that the Developer can pick up later.

### `runDeveloper`

`runDeveloper()` does this:

1. Load a previously saved `brief.json`.
2. Load the saved `meta.json` and `requirement.json`.
3. Rejoin the same OpenAI conversation.
4. Run the Developer agent.
5. Save `developer-plan.json`.

This mode is the resume point for delegated work.

### `runSync`

`runSync()` does this:

1. Run `runAsync()`.
2. Run `runDeveloper()`.
3. Run the Reviewer agent against both outputs.
4. Save `review.json`.

This mode is for a synchronous closed loop where the Product Owner side also checks the Developer output immediately.

## 7. Conversation and state handling

The runtime uses server-side conversations and Agents SDK sessions together.

The conversation is created with the base OpenAI SDK.
The agents then attach to that same conversation with `OpenAIConversationsSession`.

That gives the system two useful properties:

- local app state stays in `WorkflowContext`
- model-visible history stays in the OpenAI conversation

The local context stores things like:

- `runId`
- `mode`
- `repoRoot`
- `requirementPath`
- `targetWorkspace`

The model does not automatically see local context unless it is included in agent instructions.

## 8. Saved artifacts

Each run is saved under `.runs/<run-id>/`.

The runtime also updates `.runs/latest/`.

Saved files can include:

- `meta.json`
- `requirement.json`
- `brief.json`
- `developer-plan.json`
- `review.json`

This makes it easy to pause after Product Owner output, resume Developer work later, or inspect the latest run without looking up a run id.

## 9. Requirements and Downloads target

The current requirement source is:

- [requirements/simple-calculator.md](/Users/derem/cloud/ai/sample_for_another_team/requirements/simple-calculator.md#L1)
- [requirements/todo.md](/Users/derem/cloud/ai/sample_for_another_team/requirements/todo.md#L1)

The todo explicitly says that the real project should be created in a new folder inside the user's `Downloads` directory.

The runtime preserves that requirement by carrying `target_workspace` through the structured outputs.

## 10. How to run it

Prerequisites:

- Node.js 22.19 or newer
- `OPENAI_API_KEY` in the environment or `.env`

Commands:

```bash
npm run run:async
npm run run:developer
npm run run:sync
```

## 11. Current limitation

The engine currently plans and coordinates work. It does not yet execute the calculator implementation in `Downloads` by itself.

That next step would usually be one of these:

- add a file-writing execution tool layer
- let the Developer stage call a controlled local tool
- create a follow-up worker that turns `DeveloperPlan` into real files

Right now, the repository is strongest as an orchestration and handoff layer, not as a full autonomous builder.
