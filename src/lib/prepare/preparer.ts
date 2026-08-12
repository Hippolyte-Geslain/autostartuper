/**
 * Turns "you owe a declaration on 31 October" into the numbers to type into it.
 *
 * This is the product's actual promise (spec §3): never a bare alert. Every
 * action carries the period it covers, the user's own figures, what they will
 * owe, and the one link that finishes the job.
 *
 * Rules of this module:
 *
 * - **Code, never AI.** Merge fields from the profile and arithmetic from rate
 *   rules. A prepared amount that came from a language model would be a guess
 *   wearing a number's clothes.
 * - **Say what is missing.** A payload with no rate is a payload that says so.
 *   Silence here becomes a wrong figure on someone's tax return.
 * - **Cents, not floats.** Same reason as the threshold evaluator: money that
 *   drifts is money that misstates a total.
 */
import type { ActionInstance } from '../rules/engine';
import type { BusinessProfile, Rule, RateRule } from '../rules/types';
import { appliesTo, activeOn } from '../rules/matcher';
import { type ISODate, parseISO } from '../rules/dates';

/** A line the UI renders as label + value, in order. */
export interface PayloadField {
  label: string;
  value: string;
  /** Shown smaller, under the value. */
  note?: string;
}

export interface PreparedPayload {
  /** One sentence: what this action is, in the user's own situation. */
  summary: string;
  fields: PayloadField[];
  /** What to do on the official site, in order. */
  checklist: string[];
  /**
   * What the app could not work out, in plain words.
   *
   * Never empty out of politeness: a caveat is the difference between a figure
   * the user can file and a figure they must check first.
   */
  caveats: string[];
}

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function euros(amount: number): string {
  return EUROS.format(amount);
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Sums a set of months in cents, then converts once. */
function sumMonths(profile: BusinessProfile, months: string[]): number {
  const cents = profile.revenueEntries
    .filter((e) => months.includes(e.month))
    .reduce((total, e) => total + Math.round(e.amount * 100), 0);
  return cents / 100;
}

/**
 * The months a URSSAF declaration due on `dueDate` covers.
 *
 * The scheduler's contract, read backwards: a period is declared at the end of
 * the following month. A monthly declaration due 31 October covers September; a
 * quarterly one due 31 October covers July, August and September.
 */
export function declaredPeriod(dueDate: ISODate, frequency: 'monthly' | 'quarterly'): string[] {
  const { y, m } = parseISO(dueDate);
  const months: string[] = [];
  const count = frequency === 'monthly' ? 1 : 3;
  for (let back = count; back >= 1; back--) {
    let year = y;
    let month = m - back;
    while (month < 1) {
      month += 12;
      year--;
    }
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

/** The rate rule in force for this profile today, if the truth layer has one. */
function rateFor(rules: Rule[], profile: BusinessProfile, today: ISODate): RateRule | undefined {
  return rules.find(
    (r): r is RateRule =>
      r.type === 'rate' && activeOn(r, today) && appliesTo(r.applies_to, profile)
  );
}

function prepareUrssaf(
  action: Extract<ActionInstance, { type: 'obligation' }>,
  profile: BusinessProfile,
  rules: Rule[],
  today: ISODate
): PreparedPayload {
  const frequency = profile.urssafFrequency ?? 'quarterly';
  const months = declaredPeriod(action.dueDate, frequency);
  const turnover = sumMonths(profile, months);
  const rate = rateFor(rules, profile, today);

  const period =
    months.length === 1
      ? monthLabel(months[0])
      : `${monthLabel(months[0])} → ${monthLabel(months[months.length - 1])}`;

  const fields: PayloadField[] = [
    { label: 'Période déclarée', value: period },
    {
      label: 'Chiffre d’affaires à déclarer',
      value: euros(turnover),
      note: 'Encaissements de la période, pas la facturation.',
    },
  ];

  const caveats: string[] = [];

  if (rate) {
    // Cent-exact, then rounded once for display — the same discipline as the
    // threshold evaluator, for the same reason.
    const dueCents = Math.round(Math.round(turnover * 100) * rate.percent) / 100;
    fields.push(
      { label: 'Taux de cotisations', value: `${rate.percent} %`.replace('.', ',') },
      {
        label: 'Cotisations estimées',
        value: euros(dueCents / 100),
        note: 'Estimation calculée par l’app — le montant officiel est celui affiché par l’Urssaf.',
      }
    );
    if (profile.activityCategory === 'service-bnc') {
      caveats.push(
        'Ce taux vaut pour une profession libérale non réglementée. Si vous relevez de la Cipav, le taux est de 23,2 % et le montant ci-dessus est surestimé.'
      );
    }
  } else {
    caveats.push(
      'Aucun taux de cotisations connu pour votre situation : l’app ne peut pas estimer le montant. Il sera calculé par l’Urssaf après votre déclaration.'
    );
  }

  if (profile.options.includes('acre')) {
    caveats.push(
      'Vous bénéficiez de l’ACRE : votre taux réel est réduit pendant la période d’exonération, donc le montant estimé est plus élevé que ce que vous paierez.'
    );
  }

  if (turnover === 0) {
    caveats.push(
      'Aucun chiffre d’affaires enregistré pour cette période. Une déclaration à 0 € reste obligatoire.'
    );
  }

  return {
    summary: `Déclaration de votre chiffre d’affaires ${
      frequency === 'monthly' ? 'mensuelle' : 'trimestrielle'
    } pour ${period}.`,
    fields,
    checklist: [
      'Connectez-vous à votre espace autoentrepreneur.urssaf.fr',
      `Saisissez ${euros(turnover)} pour la période ${period}`,
      'Vérifiez le montant des cotisations affiché par l’Urssaf',
      'Validez et payez',
    ],
    caveats,
  };
}

function prepareThresholdAlert(
  action: Extract<ActionInstance, { type: 'threshold-alert' }>
): PreparedPayload {
  const remaining = action.limit - action.ytd;
  return {
    summary:
      action.level === 'exceeded'
        ? `Vous avez dépassé ce seuil de ${euros(action.ytd - action.limit)} cette année.`
        : `Il vous reste ${euros(remaining)} avant d’atteindre ce seuil cette année.`,
    fields: [
      { label: 'Encaissé depuis le 1er janvier', value: euros(action.ytd) },
      { label: 'Seuil', value: euros(action.limit) },
      { label: 'Où vous en êtes', value: `${Math.round(action.ratio * 100)} %` },
    ],
    checklist: [
      'Vérifiez le total sur votre livre de recettes',
      'Lisez les conséquences exactes sur la fiche officielle',
      'Si le dépassement est confirmé, anticipez le changement de régime',
    ],
    caveats: [
      'Le calcul porte sur l’année civile en cours et sur les montants que vous avez saisis dans l’app.',
    ],
  };
}

function prepareGeneric(action: ActionInstance): PreparedPayload {
  return {
    summary:
      action.type === 'step'
        ? 'Une démarche à faire une fois.'
        : `À faire pour le ${action.type === 'obligation' ? action.dueDate : ''}.`,
    fields: [],
    checklist: ['Ouvrez la page officielle', 'Suivez la procédure indiquée', 'Revenez marquer l’action comme faite'],
    caveats: [],
  };
}

/**
 * A stable key for one action instance.
 *
 * The due date is part of it because a monthly declarer has three actions with
 * the same id and different dates, and each one prepares different figures.
 */
export function actionKey(action: ActionInstance): string {
  return `${action.type}:${action.id}:${action.type === 'obligation' ? action.dueDate : ''}`;
}

/**
 * The payload for one action, or a generic one when nothing specific is known.
 *
 * Dispatches on the rule id rather than only on the action type: two
 * obligations are not interchangeable, and "declare your turnover" needs
 * arithmetic that "pay the CFE" does not. An unknown id falls back to a
 * checklist that is honest about knowing nothing in particular — never to an
 * invented amount.
 */
export function prepare(
  action: ActionInstance,
  profile: BusinessProfile,
  rules: Rule[],
  today: ISODate
): PreparedPayload {
  if (action.type === 'obligation' && action.id === 'urssaf-declaration-micro') {
    return prepareUrssaf(action, profile, rules, today);
  }
  if (action.type === 'threshold-alert') {
    return prepareThresholdAlert(action);
  }
  if (action.type === 'obligation' && action.id === 'cfe-paiement') {
    return {
      summary: 'Cotisation foncière des entreprises, à payer avant le 15 décembre.',
      fields: [{ label: 'Échéance', value: action.dueDate }],
      checklist: [
        'Connectez-vous à votre espace professionnel sur impots.gouv.fr',
        'Ouvrez votre avis de CFE (il n’est pas envoyé par courrier)',
        'Payez en ligne avant la date limite',
      ],
      caveats: [
        'Vous êtes exonéré de CFE pour votre année de création, et la base minimum est divisée par deux la deuxième année. L’app ne connaît pas encore votre date de création pour trancher.',
        'Le montant dépend de votre commune : il n’est pas calculable par l’app.',
      ],
    };
  }
  return prepareGeneric(action);
}
