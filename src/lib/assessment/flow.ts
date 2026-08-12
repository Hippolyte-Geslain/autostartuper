/**
 * The assessment, as data rather than as screens.
 *
 * Which questions remain, and how the answers become a profile. No React, no
 * routing, no fetch — so the whole flow is testable without a DOM, and the UI
 * stays a rendering of `pendingQuestions()` instead of a hand-written sequence
 * of steps that has to be kept in step with the profile shape.
 *
 * The governing rule is the one from the SIREN mapper: **never ask what is
 * already known, never assume what is not.** A question disappears the moment
 * the registry or an earlier answer settles it.
 */
import type { RegistryCompany } from '../siren/map';
import {
  BusinessProfileSchema,
  type ParsedBusinessProfile,
} from '../profile/schema';
import { derivePhase } from '../profile/lifecycle';
import type {
  ActivityCategory,
  KnownOption,
  LegalForm,
  UrssafFrequency,
} from '../rules/types';
import { type ISODate, parseISO } from '../rules/dates';

export interface AssessmentAnswers {
  legalForm?: LegalForm;
  activityCategory?: ActivityCategory;
  urssafFrequency?: UrssafFrequency;
  options?: KnownOption[];
  /** Turnover already collected this calendar year, in euros. */
  revenueYtd?: number;
  /** Pre-creation only: the file is in, the registration is not through yet. */
  registrationSubmitted?: boolean;
  /** Every lancement step is done. Ends the launch phase early. */
  setupStepsComplete?: boolean;
}

export interface AssessmentState {
  /** The registry record, when the user came in through the SIREN branch. */
  company?: RegistryCompany;
  answers: AssessmentAnswers;
}

export type QuestionId = keyof AssessmentAnswers;

export interface QuestionOption<T> {
  value: T;
  /** French, addressed to the user — this is the label the UI shows. */
  label: string;
  hint?: string;
}

export interface Question {
  id: QuestionId;
  prompt: string;
  /** Empty for free-form answers (a number, a yes/no the UI renders itself). */
  options: QuestionOption<string | boolean>[];
  help?: string;
}

export function startFromCompany(company: RegistryCompany): AssessmentState {
  return { company, answers: {} };
}

export function startFromScratch(): AssessmentState {
  return { answers: {} };
}

const ALL_FORMS: LegalForm[] = ['micro', 'ei', 'eurl', 'sasu'];

const FORM_LABELS: Record<LegalForm, QuestionOption<string>> = {
  micro: { value: 'micro', label: 'Micro-entreprise', hint: 'Régime simplifié, plafonds de CA' },
  ei: { value: 'ei', label: 'Entreprise individuelle au réel', hint: 'Sans le régime micro' },
  eurl: { value: 'eurl', label: 'EURL', hint: 'Société à associé unique' },
  sasu: { value: 'sasu', label: 'SASU', hint: 'Société par actions à associé unique' },
};

const ACTIVITY_OPTIONS: QuestionOption<ActivityCategory>[] = [
  { value: 'vente', label: 'Vente de marchandises ou hébergement', hint: 'Achat-revente, e-commerce, gîte…' },
  { value: 'service-bic', label: 'Prestations de services commerciales (BIC)', hint: 'Artisanat, réparation, transport…' },
  { value: 'service-bnc', label: 'Prestations de services libérales (BNC)', hint: 'Conseil, développement, design…' },
];

/**
 * The questions still worth asking, in the order they should be shown.
 *
 * Later questions can depend on earlier answers — the URSSAF frequency is a
 * micro-only choice, so it appears only once the form is known to be micro.
 * The list simply shortens as answers arrive; there is no step counter to keep
 * in sync.
 */
/**
 * The legal form in force right now: what the user answered, or the registry's
 * single candidate.
 *
 * A lone candidate is not a question. The register saying `5720` means SASU and
 * nothing else, so asking would be theatre — the recap screen is where the user
 * confirms or corrects it, as the spec's "prefilled profile" step intends.
 */
function effectiveLegalForm(state: AssessmentState): LegalForm | undefined {
  if (state.answers.legalForm) return state.answers.legalForm;
  const candidates = state.company?.legalFormCandidates ?? [];
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function pendingQuestions(state: AssessmentState): Question[] {
  const { company, answers } = state;
  const legalForm = effectiveLegalForm(state);
  const questions: Question[] = [];

  if (!company && answers.registrationSubmitted === undefined) {
    questions.push({
      id: 'registrationSubmitted',
      prompt: 'Avez-vous déjà déposé votre demande d’immatriculation ?',
      options: [
        { value: true, label: 'Oui, c’est déposé' },
        { value: false, label: 'Pas encore' },
      ],
      help: 'Cela nous dit si vous êtes encore au stade du projet.',
    });
  }

  if (!legalForm) {
    // Several candidates, or none: ask. With none, offer every v1 form — a user
    // whose category we do not map should still get through.
    const candidates = company?.legalFormCandidates?.length
      ? company.legalFormCandidates
      : ALL_FORMS;
    questions.push({
      id: 'legalForm',
      prompt: company
        ? 'Sous quelle forme exercez-vous exactement ?'
        : 'Quelle forme envisagez-vous ?',
      options: candidates.map((f) => FORM_LABELS[f]),
      help: company
        ? 'Le registre ne dit pas si vous avez opté pour le régime micro : c’est un choix fiscal.'
        : 'Vous pourrez en changer plus tard.',
    });
  }

  if (!answers.activityCategory) {
    questions.push({
      id: 'activityCategory',
      prompt: 'Quelle est votre activité principale ?',
      options: ACTIVITY_OPTIONS,
      help: 'Les plafonds de CA et la TVA ne sont pas les mêmes selon la catégorie.',
    });
  }

  if (legalForm === 'micro' && !answers.urssafFrequency) {
    questions.push({
      id: 'urssafFrequency',
      prompt: 'À quelle fréquence déclarez-vous votre chiffre d’affaires à l’Urssaf ?',
      options: [
        { value: 'monthly', label: 'Tous les mois' },
        { value: 'quarterly', label: 'Tous les trimestres' },
      ],
      help: 'Choisi à l’inscription. C’est ce qui fixe vos dates de déclaration.',
    });
  }

  if (!answers.options) {
    questions.push({
      id: 'options',
      prompt: 'Bénéficiez-vous d’une de ces options ?',
      options: [
        { value: 'acre', label: 'ACRE', hint: 'Exonération partielle de cotisations en début d’activité' },
        {
          value: 'versement-liberatoire',
          label: 'Versement libératoire',
          hint: 'Impôt sur le revenu payé en même temps que les cotisations',
        },
      ],
      help: 'Plusieurs réponses possibles, ou aucune.',
    });
  }

  // Only a registered business can have turnover, and only a running business
  // has a setup checklist left to finish.
  if (company && answers.revenueYtd === undefined) {
    questions.push({
      id: 'revenueYtd',
      prompt: 'Quel chiffre d’affaires avez-vous encaissé depuis le 1er janvier ?',
      options: [],
      help: 'Une estimation suffit pour commencer — vous pourrez l’ajuster mois par mois.',
    });
  }

  if (company && answers.setupStepsComplete === undefined) {
    questions.push({
      id: 'setupStepsComplete',
      prompt: 'Vos démarches de lancement sont-elles toutes faites ?',
      options: [
        { value: true, label: 'Oui, tout est en place' },
        { value: false, label: 'Non, ou je ne sais pas' },
      ],
      help: 'Compte bancaire dédié, assurance, déclaration initiale de CFE…',
    });
  }

  return questions;
}

export type BuildResult =
  | { ok: true; profile: ParsedBusinessProfile }
  /**
   * What is blocking. Question ids for missing or rejected answers, plus
   * `company-closed` — not a question, a state the user has to resolve
   * elsewhere, and one the app must not paper over by building a profile as if
   * the business were running.
   */
  | { ok: false; missing: (QuestionId | 'company-closed')[] };

/** `YYYY-MM` of a `YYYY-MM-DD`. */
function monthOf(date: ISODate): string {
  const { y, m } = parseISO(date);
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Answers + registry record → a validated profile.
 *
 * The phase is derived, never asked: the registration date and the checklist
 * answer decide it (see `derivePhase`). `nearingPlafond` is deliberately not
 * passed — promotion to `croissance` belongs to the dashboard, which has the
 * engine's alerts; the assessment has only what the user typed.
 *
 * The declared turnover is stored as a single entry in the current month. Any
 * month of the current year would give the same threshold total, and the
 * dashboard lets the user split it properly later; what matters is that the
 * figure enters as data the schema has checked, not as a number kept aside.
 */
export function buildProfile(state: AssessmentState, today: ISODate): BuildResult {
  const { company, answers } = state;
  const missing: (QuestionId | 'company-closed')[] = pendingQuestions(state).map((q) => q.id);

  if (company && !company.active) missing.push('company-closed');
  if (missing.length > 0) return { ok: false, missing };

  // A declared zero is simply no entry. Anything else becomes one and goes
  // through the schema — including a negative, which must fail loudly here
  // rather than be dropped on the floor and treated as "nothing earned".
  const revenueEntries =
    company && answers.revenueYtd !== undefined && answers.revenueYtd !== 0
      ? [{ month: monthOf(today), amount: answers.revenueYtd }]
      : [];

  const lifecyclePhase = derivePhase(
    {
      registeredOn: company?.registeredOn,
      registrationSubmitted: answers.registrationSubmitted ?? Boolean(company),
      setupStepsComplete: answers.setupStepsComplete ?? false,
    },
    today
  );

  const parsed = BusinessProfileSchema.safeParse({
    legalForm: effectiveLegalForm(state),
    activityCategory: answers.activityCategory,
    lifecyclePhase,
    options: answers.options ?? [],
    urssafFrequency: answers.urssafFrequency,
    revenueEntries,
    siren: company?.siren,
    registeredOn: company?.registeredOn,
  });

  if (!parsed.success) {
    // A schema rejection here means an answer the questions accepted but the
    // profile will not — a negative turnover, say. Report it as the question it
    // came from so the UI can send the user back to that field rather than
    // showing a validation error with nowhere to go.
    const fields = new Set(parsed.error.issues.map((i) => String(i.path[0])));
    const blame: QuestionId[] = [];
    if (fields.has('revenueEntries')) blame.push('revenueYtd');
    if (fields.has('legalForm')) blame.push('legalForm');
    if (fields.has('activityCategory')) blame.push('activityCategory');
    if (fields.has('options')) blame.push('options');
    if (fields.has('urssafFrequency')) blame.push('urssafFrequency');
    return { ok: false, missing: blame.length > 0 ? blame : ['legalForm'] };
  }

  return { ok: true, profile: parsed.data };
}
