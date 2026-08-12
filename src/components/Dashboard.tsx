'use client';

/**
 * The two home views and the focus card.
 *
 * Which view is the default comes from `buildDashboard`, not from here; this
 * file only draws it. Both views stay reachable through the toggle — the phase
 * decides where you land, never where you may go.
 */
import { useState } from 'react';
import type { ActionInstance } from '@/lib/rules/engine';
import type { DashboardModel } from '@/lib/dashboard/view';
import { PHASE_ORDER, PHASE_LABELS, formatCountdown, daysUntil } from '@/lib/dashboard/view';
import type { ParsedBusinessProfile } from '@/lib/profile/schema';
import type { PreparedPayload } from '@/lib/prepare/preparer';
import { actionKey } from '@/lib/prepare/preparer';
import { Badge, Button, Card, SourceLink, formatDate, formatEuros } from './ui';

interface Props {
  profile: ParsedBusinessProfile;
  model: DashboardModel;
  prepared: Record<string, PreparedPayload>;
  today: string;
  completedStepIds: string[];
  onToggleStep: (id: string) => void;
  onRestart: () => void;
}

export function Dashboard({
  profile,
  model,
  prepared,
  today,
  completedStepIds,
  onToggleStep,
  onRestart,
}: Props) {
  const [view, setView] = useState(model.view);
  const [focused, setFocused] = useState<ActionInstance | null>(null);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Votre feuille de route</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {PHASE_LABELS[profile.lifecyclePhase]}
            {profile.siren ? ` · SIREN ${profile.siren}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === 'parcours' ? 'primary' : 'secondary'}
            onClick={() => setView('parcours')}
          >
            Parcours
          </Button>
          <Button
            variant={view === 'pilotage' ? 'primary' : 'secondary'}
            onClick={() => setView('pilotage')}
          >
            Pilotage
          </Button>
        </div>
      </header>

      {focused ? (
        <FocusCard
          action={focused}
          payload={prepared[actionKey(focused)]}
          onClose={() => setFocused(null)}
          onToggleStep={onToggleStep}
          completed={completedStepIds.includes(focused.id)}
        />
      ) : view === 'parcours' ? (
        <Parcours
          profile={profile}
          model={model}
          today={today}
          completedStepIds={completedStepIds}
          onToggleStep={onToggleStep}
          onFocus={setFocused}
        />
      ) : (
        <Pilotage model={model} today={today} onFocus={setFocused} />
      )}

      <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs text-zinc-500 dark:border-zinc-800">
        <p>
          Informations à titre indicatif, issues de sources officielles. Ce n’est pas un conseil
          juridique ou fiscal.
        </p>
        <button onClick={onRestart} className="mt-2 underline underline-offset-2">
          Recommencer le questionnaire
        </button>
      </footer>
    </div>
  );
}

function Parcours({
  profile,
  model,
  today,
  completedStepIds,
  onToggleStep,
  onFocus,
}: {
  profile: ParsedBusinessProfile;
  model: DashboardModel;
  today: string;
  completedStepIds: string[];
  onToggleStep: (id: string) => void;
  onFocus: (a: ActionInstance) => void;
}) {
  const currentIndex = PHASE_ORDER.indexOf(profile.lifecyclePhase);
  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr]">
      <ol className="flex flex-col gap-1">
        {PHASE_ORDER.map((phase, i) => {
          const state = i < currentIndex ? 'past' : i === currentIndex ? 'current' : 'future';
          return (
            <li
              key={phase}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                state === 'current'
                  ? 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : state === 'past'
                    ? 'text-zinc-400'
                    : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <span aria-hidden>{state === 'past' ? '✓' : state === 'current' ? '▸' : '○'}</span>
              {PHASE_LABELS[phase]}
              {state === 'current' && <span className="sr-only">— vous êtes ici</span>}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-4">
        {/*
          Alerts show here as well as in the cockpit. A ceiling does not wait
          for the user to reach the routine phase: someone four months into
          their first year can pass the TVA franchise, and the timeline view
          would otherwise be the one screen that never says so.
        */}
        {model.alerts.map((a) => (
          <AlertCard key={a.id} alert={a} />
        ))}

        {model.steps.length === 0 && model.obligations.length === 0 && (
          <Card>
            <p className="text-sm">
              Rien à faire dans les 90 prochains jours. C’est une bonne nouvelle — revenez quand
              votre situation change.
            </p>
          </Card>
        )}

        {model.steps.map((step) => (
          <Card key={step.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-medium">{step.title}</h3>
                <div className="mt-2">
                  <SourceLink href={step.sourceUrl} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <Button variant="secondary" onClick={() => onFocus(step)}>
                  Ouvrir
                </Button>
                <Button variant="ghost" onClick={() => onToggleStep(step.id)}>
                  {completedStepIds.includes(step.id) ? 'À refaire' : 'Marquer fait'}
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {model.obligations.map((o) => (
          <ObligationRow key={`${o.id}-${o.dueDate}`} action={o} today={today} onFocus={onFocus} />
        ))}
      </div>
    </div>
  );
}

function Pilotage({
  model,
  today,
  onFocus,
}: {
  model: DashboardModel;
  today: string;
  onFocus: (a: ActionInstance) => void;
}) {
  return (
    <div className="mt-8 flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Prochaine échéance</div>
          <div className="mt-2 text-lg font-semibold">
            {model.nextDeadline ? formatDate(model.nextDeadline.action.dueDate) : '—'}
          </div>
          {model.nextDeadline && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {formatCountdown(model.nextDeadline.days)}
            </div>
          )}
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Actions à venir</div>
          <div className="mt-2 text-lg font-semibold">
            {model.obligations.length + model.steps.length}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-400">sur 90 jours</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">Seuils</div>
          <div className="mt-2 text-lg font-semibold">
            {model.alerts.length === 0 ? 'Rien à signaler' : `${model.alerts.length} alerte(s)`}
          </div>
        </Card>
      </div>

      {model.alerts.map((a) => (
        <AlertCard key={a.id} alert={a} />
      ))}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Échéances à venir
        </h2>
        {model.obligations.length === 0 ? (
          <Card>
            <p className="text-sm">Aucune échéance dans les 90 prochains jours.</p>
          </Card>
        ) : (
          model.obligations.map((o) => (
            <ObligationRow key={`${o.id}-${o.dueDate}`} action={o} today={today} onFocus={onFocus} />
          ))
        )}
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Extract<ActionInstance, { type: 'threshold-alert' }> }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">{alert.title}</h3>
        <Badge tone={alert.level === 'exceeded' ? 'danger' : 'warning'}>
          {alert.level === 'exceeded' ? 'Seuil dépassé' : 'Seuil proche'}
        </Badge>
      </div>
      <Gauge ratio={alert.ratio} />
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {formatEuros(alert.ytd)} encaissés sur {formatEuros(alert.limit)} (
        {Math.round(alert.ratio * 100)} %)
      </p>
      <div className="mt-3">
        <SourceLink href={alert.sourceUrl} />
      </div>
    </Card>
  );
}

/** The bar is capped at 100 % so an overshoot stays readable rather than overflowing. */
function Gauge({ ratio }: { ratio: number }) {
  const pct = Math.min(ratio, 1) * 100;
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full ${ratio >= 1 ? 'bg-red-600' : 'bg-amber-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ObligationRow({
  action,
  today,
  onFocus,
}: {
  action: Extract<ActionInstance, { type: 'obligation' }>;
  today: string;
  onFocus: (a: ActionInstance) => void;
}) {
  const days = daysUntil(action.dueDate, today);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">{action.title}</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatDate(action.dueDate)} · {formatCountdown(days)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {days <= 7 && <Badge tone={days < 0 ? 'danger' : 'warning'}>Urgent</Badge>}
          <Button variant="secondary" onClick={() => onFocus(action)}>
            Ouvrir
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * View C — one action, full screen, with everything the app prepared for it.
 *
 * The order is the point: what it is, then your figures, then the steps, then
 * the caveats, then the link out. A user should be able to work top to bottom
 * and be done.
 */
function FocusCard({
  action,
  payload,
  completed,
  onClose,
  onToggleStep,
}: {
  action: ActionInstance;
  payload?: PreparedPayload;
  completed: boolean;
  onClose: () => void;
  onToggleStep: (id: string) => void;
}) {
  return (
    <div className="mt-8">
      <Button variant="ghost" onClick={onClose}>
        ← Retour
      </Button>
      <Card className="mt-4">
        <h2 className="text-xl font-semibold">{action.title}</h2>

        {action.type === 'obligation' && (
          <p className="mt-3 text-sm">
            À faire pour le <strong>{formatDate(action.dueDate)}</strong>.
          </p>
        )}
        {payload && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{payload.summary}</p>}

        {payload && payload.fields.length > 0 && (
          <dl className="mt-6 grid gap-4 rounded-lg bg-zinc-50 p-4 sm:grid-cols-2 dark:bg-zinc-800/50">
            {payload.fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs uppercase tracking-wide text-zinc-500">{f.label}</dt>
                <dd className="text-lg font-semibold">{f.value}</dd>
                {f.note && <p className="mt-1 text-xs text-zinc-500">{f.note}</p>}
              </div>
            ))}
          </dl>
        )}

        {payload && payload.checklist.length > 0 && (
          <ol className="mt-6 flex flex-col gap-2 text-sm">
            {payload.checklist.map((item, i) => (
              <li key={item} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium dark:bg-zinc-700">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        )}

        {payload?.caveats.map((caveat) => (
          <p
            key={caveat}
            className="mt-4 rounded-lg border-l-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {caveat}
          </p>
        ))}

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={action.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Ouvrir le site officiel ↗
          </a>
          {action.type === 'step' && (
            <Button variant="secondary" onClick={() => onToggleStep(action.id)}>
              {completed ? 'Marquer à refaire' : 'Marquer fait'}
            </Button>
          )}
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          Les montants sont calculés à partir de vos chiffres et des taux officiels. L’app ne
          transmet rien à votre place : vous validez sur le site officiel.
        </p>
      </Card>
    </div>
  );
}
