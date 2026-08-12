'use client';

/**
 * The assessment, on screen.
 *
 * The component owns no logic about *what* to ask — `pendingQuestions()` does —
 * so adding a question to the flow never means editing this file. What lives
 * here is the branch choice, the company search, and the recap where the user
 * confirms what the registry said before anything is saved.
 *
 * Every failure path keeps a [Réessayer] button next to a manual way forward,
 * which is the spec's global retry rule: an API being down must never be a dead
 * end.
 */
import { useState } from 'react';
import type { RegistryCompany } from '@/lib/siren/map';
import {
  pendingQuestions,
  buildProfile,
  startFromCompany,
  startFromScratch,
  type AssessmentState,
  type Question,
} from '@/lib/assessment/flow';
import type { ParsedBusinessProfile } from '@/lib/profile/schema';
import type { KnownOption } from '@/lib/rules/types';
import { ACTIVITY_LABELS, LEGAL_FORM_LABELS, PHASE_LABELS } from '@/lib/dashboard/view';
import { Button, Card, formatDate } from './ui';

type Screen = 'branch' | 'search' | 'questions' | 'recap';

interface SearchFailure {
  message: string;
  retryable: boolean;
}

export function AssessmentWizard({ onDone }: { onDone: (profile: ParsedBusinessProfile) => void }) {
  const [screen, setScreen] = useState<Screen>('branch');
  const [state, setState] = useState<AssessmentState>(startFromScratch());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RegistryCompany[]>([]);
  const [failure, setFailure] = useState<SearchFailure | null>(null);
  const [searching, setSearching] = useState(false);

  const questions = pendingQuestions(state);

  async function search() {
    setSearching(true);
    setFailure(null);
    const digits = query.replace(/\D/g, '');
    // Nine digits is a SIREN; anything else is a name. Guessing here saves the
    // user from having to know which box they are in.
    const param = digits.length === 9 ? `siren=${digits}` : `q=${encodeURIComponent(query)}`;
    try {
      const response = await fetch(`/api/company?${param}`);
      const body = await response.json();
      if (body.ok) {
        setResults(body.companies);
        if (body.companies.length === 0) {
          setFailure({ message: 'Aucune entreprise trouvée.', retryable: false });
        }
      } else {
        setResults([]);
        setFailure({ message: messageFor(body.reason), retryable: Boolean(body.retryable) });
      }
    } catch {
      setResults([]);
      setFailure({ message: 'Connexion impossible.', retryable: true });
    } finally {
      setSearching(false);
    }
  }

  function choose(company: RegistryCompany) {
    setState(startFromCompany(company));
    setScreen('questions');
  }

  function answer(id: Question['id'], value: unknown) {
    setState((s) => ({ ...s, answers: { ...s.answers, [id]: value } }));
  }

  function finish() {
    const today = new Date().toISOString().slice(0, 10);
    const result = buildProfile(state, today);
    if (result.ok) onDone(result.profile);
  }

  if (screen === 'branch') {
    return (
      <Shell title="Où en êtes-vous ?" subtitle="Deux questions, et votre feuille de route est prête.">
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => setScreen('search')}
            className="rounded-xl border border-zinc-200 p-6 text-left transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100"
          >
            <div className="text-lg font-semibold">J’ai déjà créé mon entreprise</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              On récupère vos informations officielles à partir de votre SIREN ou de votre nom.
            </p>
          </button>
          <button
            onClick={() => {
              setState(startFromScratch());
              setScreen('questions');
            }}
            className="rounded-xl border border-zinc-200 p-6 text-left transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100"
          >
            <div className="text-lg font-semibold">Pas encore</div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              On part de votre projet et on liste les démarches à faire.
            </p>
          </button>
        </div>
      </Shell>
    );
  }

  if (screen === 'search') {
    return (
      <Shell
        title="Retrouvons votre entreprise"
        subtitle="Votre SIREN (9 chiffres) ou le nom de votre entreprise."
      >
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="830 141 321 ou Mon Entreprise"
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button type="submit" disabled={searching || query.trim().length === 0}>
            {searching ? 'Recherche…' : 'Rechercher'}
          </Button>
        </form>

        {failure && (
          <Card className="mt-4">
            <p className="text-sm">{failure.message}</p>
            <div className="mt-3 flex gap-2">
              {failure.retryable && (
                <Button variant="secondary" onClick={() => void search()}>
                  Réessayer
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  // Never a dead end: the wizard can answer everything itself.
                  setState(startFromScratch());
                  setScreen('questions');
                }}
              >
                Saisir mes informations à la main
              </Button>
            </div>
          </Card>
        )}

        {results.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {results.map((c) => (
              <li key={c.siren}>
                <button
                  onClick={() => choose(c)}
                  className="w-full rounded-lg border border-zinc-200 p-4 text-left hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{c.name}</span>
                    {!c.active && (
                      <span className="text-xs text-red-700 dark:text-red-400">fermée</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    SIREN {c.siren}
                    {c.registeredOn ? ` · créée le ${formatDate(c.registeredOn)}` : ''}
                    {c.apeCode ? ` · APE ${c.apeCode}` : ''}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <Button variant="ghost" onClick={() => setScreen('branch')}>
            ← Retour
          </Button>
        </div>
      </Shell>
    );
  }

  if (screen === 'questions') {
    const current = questions[0];
    if (!current) {
      setScreen('recap');
      return null;
    }
    return (
      <Shell title={current.prompt} subtitle={current.help}>
        <QuestionInput question={current} state={state} onAnswer={answer} />
        <p className="mt-6 text-xs text-zinc-500">
          {questions.length} question{questions.length > 1 ? 's' : ''} restante
          {questions.length > 1 ? 's' : ''}
        </p>
      </Shell>
    );
  }

  const result = buildProfile(state, new Date().toISOString().slice(0, 10));
  return (
    <Shell title="Vérifions" subtitle="Corrigez si quelque chose ne va pas — rien n’est encore enregistré.">
      {result.ok ? (
        <>
          <Card>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Forme" value={LEGAL_FORM_LABELS[result.profile.legalForm]} />
              <Row label="Activité" value={ACTIVITY_LABELS[result.profile.activityCategory]} />
              <Row label="Étape" value={PHASE_LABELS[result.profile.lifecyclePhase]} />
              {result.profile.siren && <Row label="SIREN" value={result.profile.siren} />}
              {result.profile.registeredOn && (
                <Row label="Créée le" value={formatDate(result.profile.registeredOn)} />
              )}
              {result.profile.urssafFrequency && (
                <Row
                  label="Déclaration Urssaf"
                  value={result.profile.urssafFrequency === 'monthly' ? 'mensuelle' : 'trimestrielle'}
                />
              )}
            </dl>
          </Card>
          <div className="mt-4 flex gap-2">
            <Button onClick={finish}>C’est exact, voir ma feuille de route</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setState({ ...state, answers: {} });
                setScreen('questions');
              }}
            >
              Reprendre les questions
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <p className="text-sm">
            {result.missing.includes('company-closed')
              ? 'Cette entreprise est fermée au registre. Choisissez-en une autre ou saisissez vos informations à la main.'
              : 'Il manque une réponse.'}
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => setScreen('search')}>
              Revenir à la recherche
            </Button>
          </div>
        </Card>
      )}
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function QuestionInput({
  question,
  state,
  onAnswer,
}: {
  question: Question;
  state: AssessmentState;
  onAnswer: (id: Question['id'], value: unknown) => void;
}) {
  const [amount, setAmount] = useState('');
  const [picked, setPicked] = useState<KnownOption[]>([]);

  if (question.id === 'revenueYtd') {
    return (
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          onAnswer('revenueYtd', Number(amount.replace(',', '.')) || 0);
        }}
      >
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit">Continuer</Button>
      </form>
    );
  }

  if (question.id === 'options') {
    // The only multiple-choice question, and the only one where "none" is a
    // real answer rather than a skipped step.
    return (
      <div className="flex flex-col gap-3">
        {question.options.map((o) => {
          const value = o.value as KnownOption;
          const on = picked.includes(value);
          return (
            <button
              key={String(o.value)}
              onClick={() => setPicked(on ? picked.filter((p) => p !== value) : [...picked, value])}
              className={`rounded-lg border p-4 text-left transition-colors ${
                on
                  ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="font-medium">{o.label}</div>
              {o.hint && <div className="text-sm text-zinc-500">{o.hint}</div>}
            </button>
          );
        })}
        <div className="flex gap-2">
          <Button onClick={() => onAnswer('options', picked)}>
            {picked.length > 0 ? 'Continuer' : 'Aucune de ces options'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {question.options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onAnswer(question.id, o.value)}
          className="rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-900 dark:border-zinc-800 dark:hover:border-zinc-100"
        >
          <div className="font-medium">{o.label}</div>
          {o.hint && <div className="text-sm text-zinc-500">{o.hint}</div>}
        </button>
      ))}
      {state.company && (
        <p className="text-xs text-zinc-500">
          Entreprise sélectionnée : {state.company.name} (SIREN {state.company.siren})
        </p>
      )}
    </div>
  );
}

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function messageFor(reason: string): string {
  switch (reason) {
    case 'invalid-siren':
      return 'Ce numéro n’est pas un SIREN valide (9 chiffres).';
    case 'not-found':
      return 'Aucune entreprise trouvée avec ces informations.';
    case 'rate-limited':
      return 'Trop de recherches d’un coup. Réessayez dans un instant.';
    case 'network':
      return 'Le service officiel ne répond pas.';
    default:
      return 'Le service officiel est indisponible pour le moment.';
  }
}
