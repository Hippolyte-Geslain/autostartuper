import { z } from 'zod';
import { isOfficialSource } from './sources';

export const LegalFormSchema = z.enum(['micro', 'ei', 'eurl', 'sasu']);
export const ActivityCategorySchema = z.enum(['vente', 'service-bic', 'service-bnc']);
export const LifecyclePhaseSchema = z.enum([
  'idee',
  'immatriculation',
  'lancement',
  'routine',
  'croissance',
]);

export type LegalForm = z.infer<typeof LegalFormSchema>;
export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;
export type LifecyclePhase = z.infer<typeof LifecyclePhaseSchema>;

export const AppliesToSchema = z.strictObject({
  legal_forms: z.array(LegalFormSchema).optional(),
  activity_categories: z.array(ActivityCategorySchema).optional(),
  lifecycle_phases: z.array(LifecyclePhaseSchema).optional(),
  options_all: z.array(z.string()).optional(),
  options_none: z.array(z.string()).optional(),
});
export type AppliesTo = z.infer<typeof AppliesToSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const ruleBase = {
  id: z.string().min(1),
  title: z.string().min(1),
  source_url: z
    .string()
    .refine(
      isOfficialSource,
      'must be an official source (gouv.fr, service-public.fr, urssaf.fr, inpi.fr, insee.fr)'
    ),
  verified_on: isoDate,
  valid_from: isoDate,
  valid_until: isoDate.optional(),
  applies_to: AppliesToSchema,
};

export const ScheduleSchema = z.discriminatedUnion('kind', [
  // periodic: frequency omitted -> engine reads profile.urssafFrequency
  z.object({
    kind: z.literal('periodic'),
    frequency: z.enum(['monthly', 'quarterly']).optional(),
  }),
  z.object({
    kind: z.literal('annual'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
]);
export type Schedule = z.infer<typeof ScheduleSchema>;

export const ObligationSchema = z.object({
  ...ruleBase,
  type: z.literal('obligation'),
  schedule: ScheduleSchema,
});
export const ThresholdSchema = z.object({
  ...ruleBase,
  type: z.literal('threshold'),
  value: z.number().positive(),
  warn_ratio: z.number().min(0).max(1).default(0.8),
});
export const RoadmapStepSchema = z.object({
  ...ruleBase,
  type: z.literal('roadmap_step'),
  phase: LifecyclePhaseSchema,
  prerequisites: z.array(z.string()).default([]),
});

export const RuleSchema = z.discriminatedUnion('type', [
  ObligationSchema,
  ThresholdSchema,
  RoadmapStepSchema,
]);

export type ObligationRule = z.infer<typeof ObligationSchema>;
export type ThresholdRule = z.infer<typeof ThresholdSchema>;
export type RoadmapStepRule = z.infer<typeof RoadmapStepSchema>;
export type Rule = z.infer<typeof RuleSchema>;

export type UrssafFrequency = 'monthly' | 'quarterly';

export interface RevenueEntry {
  month: string; // YYYY-MM
  amount: number; // euros
}

export interface BusinessProfile {
  legalForm: LegalForm;
  activityCategory: ActivityCategory;
  lifecyclePhase: LifecyclePhase;
  options: string[]; // e.g. 'acre', 'versement-liberatoire'
  urssafFrequency?: UrssafFrequency;
  revenueEntries: RevenueEntry[];
}
