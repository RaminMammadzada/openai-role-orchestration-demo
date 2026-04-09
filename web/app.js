const state = {
  payload: null,
  formDirty: false,
};

const workspaceForm = document.getElementById("workspace-form");
const commentForm = document.getElementById("comment-form");
const questionForm = document.getElementById("question-form");

document.getElementById("save-workspace").addEventListener("click", saveWorkspace);
workspaceForm.addEventListener("input", () => {
  state.formDirty = true;
});
commentForm.addEventListener("submit", submitComment);
questionForm.addEventListener("submit", submitQuestion);

document.querySelectorAll(".orchestration-action").forEach((button) => {
  button.addEventListener("click", async () => {
    await runOrchestration(button.dataset.mode, button);
  });
});

document.querySelectorAll("[data-question]").forEach((button) => {
  button.addEventListener("click", () => {
    questionForm.elements.role.value = button.dataset.role || "product_owner";
    questionForm.elements.question.value = button.dataset.question || "";
    questionForm.elements.question.focus();
  });
});

await refreshState();

async function refreshState() {
  const payload = await request("/api/state");
  state.payload = payload;
  render(payload, { hydrateForm: !state.formDirty });
}

async function saveWorkspace() {
  ensureState();

  const nextWorkspace = {
    ...state.payload.workspace,
    workspace_title: readField("workspace_title"),
    project_name: readField("project_name"),
    repository_name: readField("repository_name"),
    business_goal: readField("business_goal"),
    feature_request: readField("feature_request"),
    target_user: readField("target_user"),
    problem_statement: readField("problem_statement"),
    repository_context: readField("repository_context"),
    futuristic_vision: readField("futuristic_vision"),
    product_owner_notes: readField("product_owner_notes"),
    collaboration_goals: readListField("collaboration_goals"),
    constraints: readListField("constraints"),
    in_scope: readListField("in_scope"),
    out_of_scope: readListField("out_of_scope"),
    acceptance_criteria: readListField("acceptance_criteria"),
    validation_checks: readListField("validation_checks"),
    product_owner_questions: readListField("product_owner_questions"),
  };

  const payload = await request("/api/workspace", {
    method: "PUT",
    body: JSON.stringify({ workspace: nextWorkspace }),
  });
  state.payload = payload;
  state.formDirty = false;
  render(payload, { hydrateForm: true });
}

async function submitComment(event) {
  event.preventDefault();

  const payload = await request("/api/comments", {
    method: "POST",
    body: JSON.stringify({
      author_role: commentForm.elements.author_role.value,
      kind: commentForm.elements.kind.value,
      section: commentForm.elements.section.value,
      message: commentForm.elements.message.value,
    }),
  });

  commentForm.reset();
  state.payload = payload;
  render(payload, { hydrateForm: !state.formDirty });
}

async function submitQuestion(event) {
  event.preventDefault();

  const button = questionForm.querySelector("button[type='submit']");
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Asking...";

  try {
    const payload = await request("/api/questions", {
      method: "POST",
      body: JSON.stringify({
        role: questionForm.elements.role.value,
        question: questionForm.elements.question.value,
      }),
    });

    questionForm.reset();
    state.payload = payload.state;
    render(payload.state, { hydrateForm: !state.formDirty });
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

async function runOrchestration(mode, button) {
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = mode === "deliver" ? "Shipping..." : "Running...";

  try {
    const payload = await request("/api/orchestrate", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
    state.payload = payload.state;
    render(payload.state, { hydrateForm: !state.formDirty });
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function render(payload, options = { hydrateForm: true }) {
  const { workspace, requirementMarkdown, todoMarkdown, latestRun, hasOpenAIKey } = payload;

  document.getElementById("metric-project").textContent = workspace.project_name;
  document.getElementById("metric-repo").textContent = workspace.repository_name;
  document.getElementById("metric-run").textContent = latestRun.meta
    ? `${latestRun.meta.mode.toUpperCase()} • ${formatDate(latestRun.meta.created_at)}`
    : "No run yet";

  document.getElementById("requirement-path").textContent = workspace.requirement_file;
  document.getElementById("todo-path").textContent = workspace.todo_file;
  document.getElementById("requirement-markdown").textContent = requirementMarkdown;
  document.getElementById("todo-markdown").textContent = todoMarkdown;

  renderStatusPill(hasOpenAIKey);
  renderComments(workspace.developer_comments);
  renderExchanges(workspace.ai_exchanges);
  renderRunSummary(latestRun);

  document.querySelectorAll(".orchestration-action").forEach((actionButton) => {
    actionButton.disabled = !hasOpenAIKey;
  });
  questionForm.querySelector("button[type='submit']").disabled = !hasOpenAIKey;

  if (options.hydrateForm) {
    hydrateWorkspaceForm(workspace);
  }
}

function hydrateWorkspaceForm(workspace) {
  writeField("workspace_title", workspace.workspace_title);
  writeField("project_name", workspace.project_name);
  writeField("repository_name", workspace.repository_name);
  writeField("business_goal", workspace.business_goal);
  writeField("feature_request", workspace.feature_request);
  writeField("target_user", workspace.target_user);
  writeField("problem_statement", workspace.problem_statement);
  writeField("repository_context", workspace.repository_context);
  writeField("futuristic_vision", workspace.futuristic_vision);
  writeField("product_owner_notes", workspace.product_owner_notes);
  writeListField("collaboration_goals", workspace.collaboration_goals);
  writeListField("constraints", workspace.constraints);
  writeListField("in_scope", workspace.in_scope);
  writeListField("out_of_scope", workspace.out_of_scope);
  writeListField("acceptance_criteria", workspace.acceptance_criteria);
  writeListField("validation_checks", workspace.validation_checks);
  writeListField("product_owner_questions", workspace.product_owner_questions);
}

function renderComments(comments) {
  const container = document.getElementById("comment-list");
  container.innerHTML = "";

  if (!comments.length) {
    container.append(createEmptyState("No collaboration comments yet."));
    return;
  }

  const template = document.getElementById("thread-item-template");
  comments.forEach((comment) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".role-badge").textContent = humanizeRole(comment.author_role);
    fragment.querySelector(".kind-badge").textContent = comment.kind;
    fragment.querySelector(".section-tag").textContent = `${comment.section} • ${comment.status}`;
    fragment.querySelector("time").textContent = formatDate(comment.created_at);
    fragment.querySelector(".thread-message").textContent = comment.message;
    container.append(fragment);
  });
}

function renderExchanges(exchanges) {
  const container = document.getElementById("qa-list");
  container.innerHTML = "";

  if (!exchanges.length) {
    container.append(createEmptyState("No AI questions yet."));
    return;
  }

  const template = document.getElementById("qa-item-template");
  exchanges.forEach((exchange) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".role-badge").textContent = humanizeRole(exchange.role);
    fragment.querySelector("time").textContent = formatDate(exchange.created_at);
    fragment.querySelector(".thread-message").textContent = exchange.question;
    fragment.querySelector(".qa-answer").textContent = exchange.answer;
    container.append(fragment);
  });
}

function renderRunSummary(latestRun) {
  const container = document.getElementById("run-summary");
  container.innerHTML = "";

  if (!latestRun.meta) {
    container.append(
      createEmptyState(
        "No orchestration run yet. Save the requirement and trigger a brief, plan review, or delivery run."
      )
    );
    return;
  }

  container.append(
    createRunCard("Run Header", [
      `Mode: ${latestRun.meta.mode}`,
      `Created: ${formatDate(latestRun.meta.created_at)}`,
      `Target workspace: ${latestRun.meta.target_workspace}`,
      `Requirement file: ${latestRun.meta.requirement_path}`,
    ])
  );

  if (latestRun.brief) {
    container.append(
      createRunCard("Product Owner Brief", [
        latestRun.brief.objective,
        latestRun.brief.summary,
      ])
    );
  }

  if (latestRun.developerPlan) {
    container.append(
      createRunCard(
        "Developer Plan",
        [latestRun.developerPlan.summary],
        latestRun.developerPlan.implementation_steps.slice(0, 5)
      )
    );
  }

  if (latestRun.review) {
    container.append(
      createRunCard("Product Review", [
        `Decision: ${latestRun.review.decision}`,
        latestRun.review.summary,
      ])
    );
  }

  if (latestRun.implementationBundle) {
    container.append(
      createRunCard(
        "Implementation Bundle",
        latestRun.implementationBundle.implementation_notes,
        latestRun.implementationBundle.files.map((file) => file.relative_path)
      )
    );
  }
}

function createRunCard(title, paragraphs, bullets = []) {
  const card = document.createElement("article");
  card.className = "run-card";

  const heading = document.createElement("strong");
  heading.textContent = title;
  card.append(heading);

  paragraphs.forEach((paragraph) => {
    if (!paragraph) {
      return;
    }
    const p = document.createElement("p");
    p.textContent = paragraph;
    card.append(p);
  });

  if (bullets.length) {
    const list = document.createElement("ul");
    bullets.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    });
    card.append(list);
  }

  return card;
}

function createEmptyState(message) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = message;
  return element;
}

function renderStatusPill(hasOpenAIKey) {
  const pill = document.getElementById("openai-status");
  pill.classList.remove("is-live", "is-missing");

  if (hasOpenAIKey) {
    pill.classList.add("is-live");
    pill.textContent = "OpenAI key detected";
  } else {
    pill.classList.add("is-missing");
    pill.textContent = "No OPENAI_API_KEY";
  }
}

function readField(name) {
  return workspaceForm.elements[name].value.trim();
}

function writeField(name, value) {
  workspaceForm.elements[name].value = value ?? "";
}

function readListField(name) {
  return workspaceForm.elements[name].value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function writeListField(name, values) {
  workspaceForm.elements[name].value = (values || []).join("\n");
}

function humanizeRole(role) {
  return role === "product_owner" ? "Product Owner" : "Developer";
}

function formatDate(isoString) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function ensureState() {
  if (!state.payload) {
    throw new Error("The collaboration workspace has not finished loading yet.");
  }
}

async function request(url, init = {}) {
  const response = await fetch(url, {
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error || "Request failed.";
    window.alert(message);
    throw new Error(message);
  }

  return payload;
}
