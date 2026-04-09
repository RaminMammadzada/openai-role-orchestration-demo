# OpenAI Orchestration Research

This repository now uses a hybrid orchestration design based on current OpenAI guidance.

## What The Docs Recommend

OpenAI's Agents SDK documentation describes two primary orchestration patterns:

- LLM-driven orchestration, where agents decide what to do next.
- Code-driven orchestration, where application code determines the sequence.

The docs explicitly say these patterns can be mixed. That is the approach used here.

OpenAI also distinguishes two common multi-agent compositions:

- manager pattern with `agent.asTool()` when one agent should keep control of the overall answer
- handoffs when a specialist should take over the conversation after routing

For this repository, code-driven sequencing is the safest default because the work product is structured and stage-based: requirements normalization, product-owner brief, developer plan, and product review.

## Best Practices Applied Here

### 1. Use structured outputs between stages

OpenAI's safety guidance recommends structured outputs between nodes to constrain data flow and reduce injection risk. This engine uses Zod-backed schemas for:

- requirement packets
- product-owner briefs
- developer plans
- product reviews

### 2. Keep untrusted requirement text out of developer messages

The requirement markdown is treated as user input to the normalizer step, not as system instructions. This follows OpenAI's guidance to avoid placing untrusted content inside high-priority prompts.

### 3. Persist workflow context with server-side conversation state

The base OpenAI SDK is used to create a conversation and normalize the requirement. The Agents SDK then reuses the same conversation through `OpenAIConversationsSession`, allowing async or sync continuation without rebuilding state locally.

### 4. Use local run context for application state

The Agents SDK docs distinguish local run context from model-visible conversation state. This engine uses local context for metadata such as:

- run id
- workflow mode
- requirement path
- target workspace

### 5. Name workflows for observability

Each stage uses a dedicated workflow name so tracing remains understandable:

- `Product Owner Brief`
- `Developer Planning`
- `Product Owner Review`

## Architecture Decision

The chosen design is:

1. OpenAI SDK normalizes raw requirement documents into a strict requirement packet.
2. Product Owner agent turns that packet into a developer-ready brief.
3. Developer agent turns that brief into an implementation plan targeted at the Downloads workspace.
4. Product review agent checks whether the plan satisfies the brief.

This is intentionally more deterministic than a fully autonomous manager agent. It is easier to validate, easier to persist, and better aligned with the repository's role-based workflow.

## Source Links

- OpenAI Agents SDK overview: https://openai.github.io/openai-agents-js/
- Agents guide and composition patterns: https://openai.github.io/openai-agents-js/guides/agents/
- Agent orchestration guide: https://openai.github.io/openai-agents-js/guides/multi-agent/
- Handoffs guide: https://openai.github.io/openai-agents-js/guides/handoffs/
- Context management guide: https://openai.github.io/openai-agents-js/guides/context/
- Node reference: https://developers.openai.com/api/docs/guides/node-reference
- Structured outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs
- Safety in building agents: https://developers.openai.com/api/docs/guides/agent-builder-safety
