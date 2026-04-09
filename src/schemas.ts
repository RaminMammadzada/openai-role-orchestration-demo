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

export type RequirementPacket = z.infer<typeof RequirementPacketSchema>;
export type ProductOwnerBrief = z.infer<typeof ProductOwnerBriefSchema>;
export type DeveloperPlan = z.infer<typeof DeveloperPlanSchema>;
export type ProductReview = z.infer<typeof ProductReviewSchema>;
