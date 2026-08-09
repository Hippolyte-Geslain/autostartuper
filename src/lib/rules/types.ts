import { z } from 'zod';
import { ISO_DATE } from './dates';
import { isOfficialSource, OFFICIAL_SUFFIXES } from './sources';

export const LegalFormSchema = z.enum(['micro', 'ei', 'eurl', 'sasu']);
export const ActivityCategorySchema = z.enum(['vente', 'service-bic', 'service-bnc']);
export const LifecyclePhaseSchema = z.enum([
  'idee',
  'immatriculation',
  'lancement',
  'routine',
  'croissance',
]);
/** Closed vocabulary so a typo'd option in YAML fails loudly instead of never matching. */
export const KnownOptionSchema = z.enum(['acre', 'versement-liberatoire']);

export type LegalForm = z.infer<typeof LegalFormSchema>;
export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;
export type LifecyclePhase = z.infer<typeof LifecyclePhaseSchema>;
export type KnownOption = z.infer<typeof KnownOptionSchema>;

export const AppliesToSchema = z.strictObject({
  legal_forms: z.array(LegalFormSchema).optional(),
  activity_categories: z.array(ActivityCategorySchema).optional(),
  lifecycle_phases: z.array(LifecyclePhaseSchema).optional(),
  options_all: z.array(KnownOptionSchema).optional(),
  options_none: z.array(KnownOptionSchema).optional(),
});
export type AppliesTo = z.infer<typeof AppliesToSchema>;

/** True only for a date that exists on the calendar (rejects 2026-02-30, 2025-13-45). */
function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * A calendar-real date in YYYY-MM-DD form.
 * Checks run in sequence and stop at the first failure, so a malformed date
 * reports only the format problem instead of piling on a calendar complaint.
 *
 * The shape check reuses `dates.ts`'s `ISO_DATE`, so what the schema accepts and
 * what the date helpers accept cannot drift apart.
 */
export const IsoDateSchema = z.string().superRefine((value, ctx) => {
  if (!ISO_DATE.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'expected YYYY-MM-DD' });
    return;
  }
  if (!isRealCalendarDate(value)) {
    ctx.addIssue({ code: 'custom', message: 'not a real calendar date' });
  }
});

/** Rule ids are slugs, so they stay safe to reference from prerequisites and URLs. */
export const RuleIdSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens only');

/** The window a rule is true for. Task 6's activeOn() compares a date against it. */
export type Millesime = { valid_from: string; valid_until?: string };

const ruleBase = {
  id: RuleIdSchema,
  title: z.string().trim().min(1),
  source_url: z
    .string()
    .refine(
      isOfficialSource,
      `must be an official https source (${OFFICIAL_SUFFIXES.join(', ')})`
    ),
  verified_on: IsoDateSchema,
  valid_from: IsoDateSchema,
  valid_until: IsoDateSchema.optional(),
  applies_to: AppliesToSchema,
};

/** Days in a month, probed against a leap year so 29 February stays legal. */
const LEAP_YEAR = 2024;
function daysInMonth(month: number): number {
  return new Date(Date.UTC(LEAP_YEAR, month, 0)).getUTCDate();
}

// periodic: frequency omitted -> engine reads profile.urssafFrequency
const PeriodicScheduleSchema = z.strictObject({
  kind: z.literal('periodic'),
  frequency: z.enum(['monthly', 'quarterly']).optional(),
});

const AnnualScheduleSchema = z
  .strictObject({
    kind: z.literal('annual'),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  })
  .refine(({ month, day }) => day <= daysInMonth(month), {
    path: ['day'],
    message: 'no such day in that month',
  });

export const ScheduleSchema = z.discriminatedUnion('kind', [
  PeriodicScheduleSchema,
  AnnualScheduleSchema,
]);
export type Schedule = z.infer<typeof ScheduleSchema>;

export const ObligationSchema = z.strictObject({
  ...ruleBase,
  type: z.literal('obligation'),
  schedule: ScheduleSchema,
});
export const ThresholdSchema = z.strictObject({
  ...ruleBase,
  type: z.literal('threshold'),
  value: z.number().positive(),
  warn_ratio: z.number().gt(0).lt(1).default(0.8),
});
export const RoadmapStepSchema = z.strictObject({
  ...ruleBase,
  type: z.literal('roadmap_step'),
  phase: LifecyclePhaseSchema,
  prerequisites: z.array(RuleIdSchema).default([]),
});

export const RuleSchema = z
  .discriminatedUnion('type', [ObligationSchema, ThresholdSchema, RoadmapStepSchema])
  .refine((r) => !r.valid_until || r.valid_until >= r.valid_from, {
    path: ['valid_until'],
    message: 'valid_until must be on or after valid_from',
  });

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
  options: KnownOption[];
  urssafFrequency?: UrssafFrequency;
  revenueEntries: RevenueEntry[];
}
