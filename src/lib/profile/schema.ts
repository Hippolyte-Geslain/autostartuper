/**
 * The user's side of the contract.
 *
 * `types.ts` in the rules layer declares `BusinessProfile` as a TypeScript
 * interface, which is enough while profiles come from test fixtures. From M2 on
 * they come from a form, an API response and `localStorage` — three sources
 * TypeScript cannot vouch for — so the same shape needs a runtime gate.
 *
 * Parse once at the boundary, then trust the value inside. Everything
 * downstream (the engine, the thresholds, the schedulers) is written against
 * the interface and stays free of defensive checks.
 */
import { z } from 'zod';
import {
  LegalFormSchema,
  ActivityCategorySchema,
  LifecyclePhaseSchema,
  KnownOptionSchema,
  IsoDateSchema,
  type BusinessProfile,
} from '../rules/types';

/** `YYYY-MM`, the granularity revenue is declared at. */
export const IsoMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'expected YYYY-MM');

/**
 * Money the user typed.
 *
 * Zero is allowed — a month with no turnover is a real answer, and one worth
 * recording rather than leaving blank. Negative is not: a refund does not make
 * turnover negative, and letting it through would quietly lower a plafond ratio
 * and withhold an alert. Corrections are made by editing the month's figure.
 *
 * Amounts are capped at two decimals because that is what euros have, and
 * because `thresholds.ts` rounds to cents when summing: accepting 10.005 here
 * would mean storing a number the totals cannot reproduce.
 */
export const RevenueEntrySchema = z.strictObject({
  month: IsoMonthSchema,
  amount: z
    .number()
    .finite()
    .min(0, 'turnover cannot be negative — correct the month instead')
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, 'at most two decimals'),
});

function firstDuplicate(values: string[]): string | undefined {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) return v;
    seen.add(v);
  }
  return undefined;
}

export const BusinessProfileSchema = z
  .strictObject({
    legalForm: LegalFormSchema,
    activityCategory: ActivityCategorySchema,
    lifecyclePhase: LifecyclePhaseSchema,
    options: z.array(KnownOptionSchema).default([]),
    urssafFrequency: z.enum(['monthly', 'quarterly']).optional(),
    revenueEntries: z.array(RevenueEntrySchema).default([]),
    /** Nine digits, present only once the business exists. */
    siren: z.string().regex(/^\d{9}$/, 'a SIREN is nine digits').optional(),
    /** The day the business was registered, as the registry states it. */
    registeredOn: IsoDateSchema.optional(),
  })
  .superRefine((p, ctx) => {
    // One entry per month is what makes a month editable. Two entries for
    // January are not "January twice", they are a total nobody intended, and
    // the difference is invisible in a gauge.
    const month = firstDuplicate(p.revenueEntries.map((e) => e.month));
    if (month) {
      ctx.addIssue({
        code: 'custom',
        path: ['revenueEntries'],
        message: `duplicate month ${month} — one entry per month`,
      });
    }
    const option = firstDuplicate(p.options);
    if (option) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `duplicate option ${option}` });
    }
  });

/**
 * The parsed profile. Assignable to the rules layer's `BusinessProfile`, which
 * is asserted below rather than hoped for: the two definitions live in
 * different files and would otherwise drift apart silently.
 */
export type ParsedBusinessProfile = z.infer<typeof BusinessProfileSchema>;

// Compile-time proof that a parsed profile is something the engine can consume.
type _AssignableToEngineProfile = ParsedBusinessProfile extends BusinessProfile ? true : never;
const _assignable: _AssignableToEngineProfile = true;
void _assignable;
