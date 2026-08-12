'use client';

/**
 * Holds the one piece of state everything else hangs off: is there a profile?
 *
 * No profile → the assessment. A profile → the dashboard, whose actions are
 * computed server-side (the rules are YAML files on disk) and refetched
 * whenever the profile or the completed steps change.
 *
 * Persistence is read through `useSyncExternalStore`, not through an effect:
 * the server snapshot is `null`, so the first client render agrees with the
 * server's and no cascading re-render is needed to discover a stored profile.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  subscribeStorage,
  profileSnapshot,
  completedStepsSnapshot,
  parseProfile,
  parseCompletedSteps,
  saveProfile,
  saveCompletedSteps,
  clearProfile,
} from '@/lib/profile/storage';
import type { DashboardModel } from '@/lib/dashboard/view';
import { AssessmentWizard } from './AssessmentWizard';
import { Dashboard } from './Dashboard';
import { Button, Card } from './ui';

interface Computed {
  model: DashboardModel;
  today: string;
}

export function App() {
  const rawProfile = useSyncExternalStore(
    subscribeStorage,
    () => profileSnapshot(),
    () => null
  );
  const rawSteps = useSyncExternalStore(
    subscribeStorage,
    () => completedStepsSnapshot(),
    () => null
  );

  const profile = useMemo(() => parseProfile(rawProfile), [rawProfile]);
  const completedStepIds = useMemo(() => parseCompletedSteps(rawSteps), [rawSteps]);

  const [computed, setComputed] = useState<Computed | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped to ask for the same computation again after a failure.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    // Every state update below happens after an await, so this never triggers
    // a cascading render on mount.
    void (async () => {
      try {
        const response = await fetch('/api/actions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ profile, completedStepIds }),
        });
        const body = await response.json();
        if (cancelled) return;
        if (!body.ok) {
          setFailed(true);
          return;
        }
        setComputed({ model: body.dashboard, today: body.today });
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, completedStepIds, attempt]);

  function onToggleStep(id: string) {
    saveCompletedSteps(
      completedStepIds.includes(id)
        ? completedStepIds.filter((s) => s !== id)
        : [...completedStepIds, id]
    );
  }

  function onRestart() {
    clearProfile();
    setComputed(null);
    setFailed(false);
  }

  if (!profile) return <AssessmentWizard onDone={saveProfile} />;

  if (failed) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <Card>
          <p className="text-sm">Impossible de calculer vos actions pour le moment.</p>
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => {
                setFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              Réessayer
            </Button>
            <Button variant="ghost" onClick={onRestart}>
              Recommencer le questionnaire
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!computed) {
    return <p className="px-6 py-16 text-center text-sm text-zinc-500">Calcul en cours…</p>;
  }

  return (
    <Dashboard
      profile={profile}
      model={computed.model}
      today={computed.today}
      completedStepIds={completedStepIds}
      onToggleStep={onToggleStep}
      onRestart={onRestart}
    />
  );
}
