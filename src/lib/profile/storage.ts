/**
 * Where the profile lives until there is an account.
 *
 * `localStorage` is the whole persistence layer of M2: no login, no server, and
 * nothing leaves the browser. It is deliberately the same shape the database
 * will hold later, so adding Supabase becomes a swap of this module rather than
 * a change to everything that reads a profile.
 *
 * Stored data is treated as untrusted input. It survives across deploys, users
 * can edit it in devtools, and a shape from an older version of the app is the
 * normal case rather than the exception — so every read goes through the schema
 * and a value that no longer parses is dropped, not repaired.
 */
import { BusinessProfileSchema, type ParsedBusinessProfile } from './schema';

export const PROFILE_KEY = 'autostartuper.profile.v1';
export const COMPLETED_STEPS_KEY = 'autostartuper.completedSteps.v1';

/** The slice of the Storage API used here, so tests need no DOM. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): StorageLike | undefined {
  try {
    // Absent during server rendering, and throws in a browser with storage
    // disabled — both mean "no persistence", which the app runs fine without.
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Storage as something React can subscribe to.
 *
 * `useSyncExternalStore` needs a subscribe/snapshot pair, and gets a correct
 * server snapshot (`null`) for free — which is what keeps the first client
 * render from disagreeing with the server's. Reading storage in an effect and
 * calling `setState` would work too, at the cost of a cascading render on every
 * load; this way the value is simply there.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeStorage(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * The raw stored strings.
 *
 * Snapshots must be referentially stable between changes or React re-renders
 * forever, so these deliberately return the string as stored and leave parsing
 * to the caller (behind a `useMemo`).
 */
export function profileSnapshot(storage: StorageLike | undefined = browserStorage()): string | null {
  return storage?.getItem(PROFILE_KEY) ?? null;
}

export function completedStepsSnapshot(
  storage: StorageLike | undefined = browserStorage()
): string | null {
  return storage?.getItem(COMPLETED_STEPS_KEY) ?? null;
}

/** Nothing stored, or something that no longer parses, is `null` either way. */
export function parseProfile(raw: string | null): ParsedBusinessProfile | null {
  if (!raw) return null;
  try {
    const parsed = BusinessProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseCompletedSteps(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function loadProfile(storage: StorageLike | undefined = browserStorage()): ParsedBusinessProfile | null {
  return parseProfile(profileSnapshot(storage));
}

export function saveProfile(
  profile: ParsedBusinessProfile,
  storage: StorageLike | undefined = browserStorage()
): void {
  storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
  emit();
}

export function clearProfile(storage: StorageLike | undefined = browserStorage()): void {
  storage?.removeItem(PROFILE_KEY);
  storage?.removeItem(COMPLETED_STEPS_KEY);
  emit();
}

export function loadCompletedSteps(
  storage: StorageLike | undefined = browserStorage()
): string[] {
  return parseCompletedSteps(completedStepsSnapshot(storage));
}

export function saveCompletedSteps(
  ids: string[],
  storage: StorageLike | undefined = browserStorage()
): void {
  // Deduplicated on the way in: the same step ticked twice is one step done,
  // and a duplicate would otherwise ride along into every later read.
  storage?.setItem(COMPLETED_STEPS_KEY, JSON.stringify([...new Set(ids)]));
  emit();
}
