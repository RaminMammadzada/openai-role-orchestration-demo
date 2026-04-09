import type {
  CollaborationComment,
  CollaborationExchange,
  CollaborationWorkspace,
  DeveloperImplementationBundle,
  DeveloperPlan,
  ProductOwnerBrief,
  ProductReview,
  RequirementPacket,
} from './schemas.ts';

export type WorkflowMode = 'sync' | 'async' | 'developer' | 'delivery';

export type WorkflowContext = {
  runId: string;
  mode: WorkflowMode;
  repoRoot: string;
  requirementPath: string;
  targetWorkspace: string;
};

export type RunArtifacts = {
  runId: string;
  runDir: string;
  conversationId: string;
  requirement: RequirementPacket;
  brief?: ProductOwnerBrief;
  developerPlan?: DeveloperPlan;
  review?: ProductReview;
  implementationBundle?: DeveloperImplementationBundle;
};

export type PersistedRunMeta = {
  run_id: string;
  mode: WorkflowMode;
  conversation_id: string;
  requirement_path: string;
  target_workspace: string;
  model: string;
  reasoning_model: string;
  created_at: string;
};

export type LatestRunSnapshot = {
  meta?: PersistedRunMeta;
  requirement?: RequirementPacket;
  brief?: ProductOwnerBrief;
  developerPlan?: DeveloperPlan;
  review?: ProductReview;
  implementationBundle?: DeveloperImplementationBundle;
};

export type CollaborationWorkspacePayload = CollaborationWorkspace;
export type CollaborationCommentPayload = CollaborationComment;
export type CollaborationExchangePayload = CollaborationExchange;
