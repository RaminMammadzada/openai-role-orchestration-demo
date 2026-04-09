import { z } from 'zod';

export const RequirementPacketSchema = z.object({
  title: z.string(),
  goal: z.string(),
  target_user: z.string(),
  problem_statement: z.string(),
  context_summary: z.string(),
  in_scope: z.array(z.string()).min(1),
  out_of_scope: z.array(z.string()),
  constraints: z.array(z.string()),
  acceptance_criteria: z.array(z.string()).min(1),
  validation: z.array(z.string()).min(1),
  open_questions: z.array(z.string()),
  todo_items: z.array(z.string()),
  target_workspace: z.string(),
});

export const DeveloperHandoffSchema = z.object({
  goal: z.string(),
  context: z.string(),
  constraints: z.array(z.string()),
  acceptance_criteria: z.array(z.string()).min(1),
  validation: z.array(z.string()).min(1),
  open_questions: z.array(z.string()),
});

export const ProductOwnerBriefSchema = z.object({
  brief_id: z.string(),
  summary: z.string(),
  objective: z.string(),
  in_scope: z.array(z.string()).min(1),
  non_goals: z.array(z.string()),
  constraints: z.array(z.string()),
  acceptance_criteria: z.array(z.string()).min(1),
  delivery_checklist: z.array(z.string()).min(1),
  developer_handoff: DeveloperHandoffSchema,
});

export const DeveloperPlanSchema = z.object({
  plan_id: z.string(),
  summary: z.string(),
  target_workspace: z.string(),
  implementation_steps: z.array(z.string()).min(1),
  files_or_modules: z.array(z.string()).min(1),
  test_strategy: z.array(z.string()).min(1),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  handoff_back_to_product_owner: z.object({
    implemented_scope: z.string(),
    validation_plan: z.array(z.string()).min(1),
    residual_risks: z.array(z.string()),
    recommended_next_step: z.string(),
  }),
});

export const ProductReviewSchema = z.object({
  review_id: z.string(),
  decision: z.enum(['accepted', 'needs_follow_up']),
  matched_acceptance_criteria: z.array(z.string()),
  gaps: z.array(z.string()),
  follow_up_actions: z.array(z.string()),
  summary: z.string(),
});

export const GeneratedFileSchema = z.object({
  relative_path: z.string(),
  purpose: z.string(),
  content: z.string(),
});

export const DeveloperImplementationBundleSchema = z.object({
  bundle_id: z.string(),
  target_workspace: z.string(),
  files: z.array(GeneratedFileSchema).min(1),
  implementation_notes: z.array(z.string()).min(1),
  validation_notes: z.array(z.string()).min(1),
});

export const CollaborationCommentSchema = z.object({
  id: z.string(),
  author_role: z.enum(['product_owner', 'developer']),
  kind: z.enum(['comment', 'question', 'decision']),
  section: z.string(),
  message: z.string(),
  status: z.enum(['open', 'resolved']),
  created_at: z.string(),
});

export const CollaborationExchangeSchema = z.object({
  id: z.string(),
  role: z.enum(['product_owner', 'developer']),
  question: z.string(),
  answer: z.string(),
  created_at: z.string(),
});

export const CollaborationWorkspaceSchema = z.object({
  workspace_id: z.string(),
  workspace_title: z.string(),
  project_name: z.string(),
  repository_name: z.string(),
  repository_context: z.string(),
  business_goal: z.string(),
  feature_request: z.string(),
  target_user: z.string(),
  problem_statement: z.string(),
  futuristic_vision: z.string(),
  product_owner_notes: z.string(),
  collaboration_goals: z.array(z.string()).min(1),
  constraints: z.array(z.string()).min(1),
  in_scope: z.array(z.string()).min(1),
  out_of_scope: z.array(z.string()),
  acceptance_criteria: z.array(z.string()).min(1),
  validation_checks: z.array(z.string()).min(1),
  product_owner_questions: z.array(z.string()),
  developer_comments: z.array(CollaborationCommentSchema),
  ai_exchanges: z.array(CollaborationExchangeSchema),
  requirement_file: z.string(),
  todo_file: z.string(),
  updated_at: z.string(),
});

export type RequirementPacket = z.infer<typeof RequirementPacketSchema>;
export type ProductOwnerBrief = z.infer<typeof ProductOwnerBriefSchema>;
export type DeveloperPlan = z.infer<typeof DeveloperPlanSchema>;
export type ProductReview = z.infer<typeof ProductReviewSchema>;
export type DeveloperImplementationBundle = z.infer<typeof DeveloperImplementationBundleSchema>;
export type CollaborationComment = z.infer<typeof CollaborationCommentSchema>;
export type CollaborationExchange = z.infer<typeof CollaborationExchangeSchema>;
export type CollaborationWorkspace = z.infer<typeof CollaborationWorkspaceSchema>;
