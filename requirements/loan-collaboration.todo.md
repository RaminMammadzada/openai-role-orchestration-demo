# Orbit Flow Deck TODO

## Product Owner Stream

- Keep [loan-collaboration.md](./loan-collaboration.md) current as the single business source of truth.
- Confirm the requested feature is framed in business language: Extend the sample loan calculator with a loan term calculation feature and make the collaboration around that feature transparent, fast, and explainable.
- Resolve product-owner question: Which files are most likely to change when the loan term feature is implemented?
- Resolve product-owner question: Can the AI explain the technical plan back in product language after a delivery run?

## AI Collaboration Stream

- Translate the product-owner brief into a developer-ready brief using the orchestration engine.
- Turn the business brief into technical tasks, implementation steps, and a validation plan.
- Answer product-owner questions about the codebase in business language and developer questions in technical language.
- Explain the latest technical output back to the Product Owner after each orchestration run.

## Developer Stream

- Review the active requirement file and companion todo before implementation starts.
- Produce a developer plan that identifies touched files, risks, and validation work.
- Comment on gaps, ambiguities, or risky assumptions directly in the collaboration thread.
- Respond to Developer question in acceptance criteria: Should the loan term feature support both monthly and yearly repayment views, or is one repayment cadence enough for the first slice?
- Respond to Developer comment in repo context: We should surface the exact loan-term assumptions in the first delivery slice.

## Acceptance Trace

- Validate this acceptance criterion in the prototype: A Product Owner can update the active requirement in the browser and save it without editing markdown directly.
- Validate this acceptance criterion in the prototype: Saving Product Owner changes rewrites the requirement markdown and a synchronized companion todo file automatically.
- Validate this acceptance criterion in the prototype: A developer can leave comments or questions in the workspace and the Product Owner can see them immediately on refresh.
- Validate this acceptance criterion in the prototype: A user can ask AI questions about the codebase or latest orchestration output and receive a role-appropriate answer.
- Validate this acceptance criterion in the prototype: A user can trigger async, sync, and delivery orchestration runs from the UI and see the latest output summary.
- Validate this acceptance criterion in the prototype: The interface feels like a futuristic collaboration environment on desktop and mobile screens.
