# Collaboration UI Prototype

## Overview

This prototype turns the repository into a shared collaboration cockpit for Product Owners and developers.

It is designed around the challenge prompt:

- business experts need a way to shape requirements without reading code
- developers need faster translation from product language to technical work
- both sides need better visibility into whether the implementation still matches the original intent

The UI focuses on one concrete scenario:

- a sample loan calculator repository needs a new loan term calculation feature

Instead of treating the Product Owner brief, developer plan, questions, comments, and generated artifacts as separate documents, the prototype puts them into one operating surface.

## What The Prototype Solves

The prototype supports several collaboration steps from the challenge statement:

- Understanding existing code
- Translating business requirements into technical tasks
- Explaining technical output in business language
- Enabling business users to ask questions about the codebase
- Keeping requirement markdown and follow-up todos synchronized

It does this with a combination of:

- a browser-based collaboration dashboard
- a persisted workspace model for Product Owner input
- automatic markdown generation
- an AI Q&A layer
- the existing OpenAI orchestration engine for briefing, planning, review, and delivery

## User Experience

The UI is intentionally split into clear lanes:

### Product Owner Deck

The Product Owner edits the requirement through structured fields instead of editing markdown directly.

The form includes:

- business goal
- requested feature
- repository context
- target user
- problem statement
- collaboration goals
- constraints
- in-scope and out-of-scope items
- acceptance criteria
- validation checks
- Product Owner questions

When the Product Owner clicks **Save Requirement**:

- the structured workspace state is persisted
- the requirement markdown file is regenerated
- the companion todo markdown file is regenerated automatically

### Generated Artifacts Deck

The UI shows two live mirrors:

- the generated requirement markdown
- the generated todo markdown

This gives business and engineering users immediate visibility into what the system will hand to the orchestration engine.

### Human Collaboration Deck

Developers and Product Owners can leave:

- comments
- questions
- decisions

Each thread entry stores:

- author role
- section
- message
- open/resolved status
- timestamp

Open questions from the collaboration thread are also reflected back into the generated requirement markdown so they stay visible to the Product Owner.

### AI Bridge

Users can ask natural-language questions in two modes:

- `product_owner`
- `developer`

The answer style changes with the role:

- Product Owners get business-friendly explanations first
- Developers get direct technical answers first

The AI question endpoint reads context from:

- the active collaboration workspace
- the latest orchestration run
- core repository files such as the README, orchestration docs, the orchestration engine, the UI server, and the active requirement file

### Orchestration Deck

The UI exposes three orchestration actions:

- `Generate Brief` -> `async`
- `Review Plan` -> `sync`
- `Ship Bundle` -> `deliver`

This keeps the AI-assisted product-to-engineering pipeline visible inside the browser instead of forcing users into the CLI.

## Architecture

## Frontend

The frontend is plain HTML, CSS, and JavaScript:

- [index.html](/Users/derem/cloud/ai/sample_for_another_team/web/index.html)
- [styles.css](/Users/derem/cloud/ai/sample_for_another_team/web/styles.css)
- [app.js](/Users/derem/cloud/ai/sample_for_another_team/web/app.js)

The frontend is intentionally framework-free so the prototype is easy to inspect and run.

The visual direction is a light futuristic “command bridge” rather than a generic admin panel:

- layered gradients
- glass-like panels
- grid background
- monospaced metadata accents
- strong role separation

## Backend

The backend is a small Node HTTP server:

- [server.ts](/Users/derem/cloud/ai/sample_for_another_team/src/server.ts)

It serves two responsibilities:

- static asset delivery for the UI
- JSON APIs for workspace persistence, AI Q&A, and orchestration

No separate frontend build step is required.

## Collaboration Workspace Layer

The collaboration workspace is implemented in:

- [workspace.ts](/Users/derem/cloud/ai/sample_for_another_team/src/collaboration/workspace.ts)

This layer provides:

- default seeded challenge state
- persistent workspace storage in `data/loan-collaboration-workspace.json`
- requirement markdown generation
- companion todo markdown generation
- comment and AI exchange persistence
- latest run snapshot loading from `.runs/latest/`

## AI Question Layer

The role-aware Q&A behavior is implemented in:

- [assistant.ts](/Users/derem/cloud/ai/sample_for_another_team/src/collaboration/assistant.ts)

This layer sends a question to OpenAI with:

- the active workspace summary
- the latest orchestration summary
- curated repo file context

The instructions change depending on whether the caller is a Product Owner or a developer.

## Existing Orchestration Engine

The UI does not create a second orchestration pipeline.

It reuses the existing engine in:

- [orchestrationEngine.ts](/Users/derem/cloud/ai/sample_for_another_team/src/engine/orchestrationEngine.ts)

The orchestration engine still owns:

- requirement normalization
- Product Owner brief generation
- developer plan generation
- review generation
- implementation bundle generation

This matters because the UI is not just a mock. It is a browser front-end over the actual role-based orchestration runtime.

## Data Flow

The main flow is:

1. Product Owner edits the structured workspace in the browser.
2. The server persists the workspace JSON.
3. The server rewrites:
   - `requirements/loan-collaboration.md`
   - `requirements/loan-collaboration.todo.md`
4. The user can ask AI questions about the repo or collaboration state.
5. The user can trigger `async`, `sync`, or `deliver`.
6. The orchestration engine saves outputs into `.runs/<run-id>/`.
7. The UI reads `.runs/latest/` and renders the latest objective, plan, review, and bundle summary.

This creates a full loop:

- business intent
- AI translation
- technical planning
- review
- delivery artifacts
- business-visible explanation

## Requirement And Todo Strategy

The repository originally used a shared `requirements/todo.md`.

That works for a single requirement, but it becomes ambiguous when more than one requirement file exists.

To avoid cross-contaminating unrelated runs, the prototype introduces a requirement-specific companion todo file:

- `requirements/loan-collaboration.todo.md`

The requirement loader was updated to look for a requirement-specific `*.todo.md` first and fall back to the shared `todo.md` only when no companion file exists.

That keeps the existing simple calculator workflow intact while allowing the new collaboration workspace to maintain its own synchronized todo file.

## API Surface

The UI server exposes these endpoints:

- `GET /api/health`
- `GET /api/state`
- `PUT /api/workspace`
- `POST /api/comments`
- `POST /api/questions`
- `POST /api/orchestrate`

### `GET /api/state`

Returns:

- workspace JSON
- requirement markdown
- todo markdown
- latest completed run snapshot
- whether an OpenAI key is available

### `PUT /api/workspace`

Accepts the full collaboration workspace payload and rewrites the generated markdown artifacts.

### `POST /api/comments`

Appends a new collaboration thread entry.

### `POST /api/questions`

Runs the role-aware AI Q&A flow and stores the exchange in the workspace history.

### `POST /api/orchestrate`

Runs one of:

- `async`
- `sync`
- `deliver`

against the active requirement file.

## Local Development

Run locally with Node:

```bash
npm install
npm run run:ui
```

Then open:

```text
http://127.0.0.1:3000
```

The port can be overridden with `COLLAB_PORT` or `PORT`.

## Docker Compose

The repository now also includes:

- [Dockerfile](/Users/derem/cloud/ai/sample_for_another_team/Dockerfile)
- [compose.yaml](/Users/derem/cloud/ai/sample_for_another_team/compose.yaml)

Run it with:

```bash
docker compose up --build
```

This launches the same Node server inside a container and exposes the cockpit on port `3000` by default.

## Why This Matches The Challenge

The challenge asked for an AI-powered prototype that improves collaboration between business and tech teams.

This prototype addresses that directly:

- Product Owners work in a business-facing UI instead of raw code or raw markdown.
- Developers can react in-context without leaving the shared workspace.
- AI answers bridge the language gap between business questions and technical answers.
- The same workspace can generate a structured brief, developer plan, review, and delivery bundle.
- The generated artifacts stay inspectable so the process is explainable, not opaque.

The prototype does not try to solve every collaboration problem.

Instead, it makes one focused loop much tighter:

- define a feature
- clarify it
- translate it
- question it
- plan it
- deliver it
- explain it

## Current Boundaries

This is still a prototype, so some boundaries remain:

- comments are persisted locally, not multi-user live
- AI Q&A uses curated file context instead of semantic retrieval
- orchestration runs are triggered manually, not event-driven
- GitHub pull requests and issue threads are not yet integrated
- access control is not implemented

Those are reasonable next steps if this prototype moves beyond a challenge/demo setting.
