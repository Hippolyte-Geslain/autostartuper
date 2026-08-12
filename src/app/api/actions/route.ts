/**
 * The engine, exposed to the browser.
 *
 * Rules are YAML files read from disk, so `computeActions` runs on the server.
 * The client posts a profile and gets back the action list — no rules ship to
 * the browser, and the truth layer stays a server-side concern.
 *
 * The profile is re-parsed here rather than trusted. It arrives from
 * `localStorage`, which the user can edit; a profile claiming an unknown legal
 * form would otherwise reach the matcher and silently match nothing.
 */
import { computeActions } from '@/lib/rules/engine';
import { loadRules } from '@/lib/rules/loader';
import { BusinessProfileSchema } from '@/lib/profile/schema';
import { buildDashboard } from '@/lib/dashboard/view';
import { ISO_DATE } from '@/lib/rules/dates';
import type { Rule } from '@/lib/rules/types';

export const dynamic = 'force-dynamic';

/**
 * Rules are read once per server process.
 *
 * They are files in the deployment, so they cannot change until the next
 * deploy, and re-reading nine YAML files on every request would buy nothing.
 * A load failure is not cached — the next request tries again, so a transient
 * filesystem error does not poison the process.
 */
let cachedRules: Rule[] | undefined;
function rules(): Rule[] {
  cachedRules ??= loadRules('rules');
  return cachedRules;
}

/** Today, in the app's own timezone terms: a plain calendar date. */
function todayInParis(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: 'bad-request' }, { status: 400 });
  }

  const { profile: rawProfile, today: rawToday, completedStepIds } = (body ?? {}) as {
    profile?: unknown;
    today?: unknown;
    completedStepIds?: unknown;
  };

  const parsed = BusinessProfileSchema.safeParse(rawProfile);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: 'invalid-profile', issues: parsed.error.issues },
      { status: 422 }
    );
  }

  // A caller-supplied date is for tests and for "what does December look like";
  // anything malformed falls back to today rather than throwing at the user.
  const today =
    typeof rawToday === 'string' && ISO_DATE.test(rawToday) ? rawToday : todayInParis();

  const ids = Array.isArray(completedStepIds)
    ? completedStepIds.filter((v): v is string => typeof v === 'string')
    : [];

  let actions;
  try {
    actions = computeActions(rules(), parsed.data, { today, completedStepIds: ids });
  } catch {
    // A broken rule file is our fault, not the user's. Say so plainly instead
    // of returning an empty list, which would read as "you have nothing to do".
    return Response.json({ ok: false, reason: 'rules-unavailable' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    today,
    actions,
    dashboard: buildDashboard(actions, parsed.data.lifecyclePhase, today),
  });
}
