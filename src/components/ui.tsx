/**
 * The handful of visual pieces every screen shares.
 *
 * Small on purpose: this is a working app, not a design system. What lives here
 * is what would otherwise be copy-pasted three times and drift.
 */
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  const styles = {
    primary:
      'bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
    secondary:
      'border border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800',
    ghost: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}

/**
 * The source link that appears on every fact the app states.
 *
 * Not decoration: the promise of this product is that anything it tells you can
 * be checked at its .gouv source in one click. A card without one is a card
 * making an unbacked claim.
 */
export function SourceLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-xs text-zinc-500 underline decoration-dotted underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      Source officielle ↗
    </a>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
}) {
  const styles = {
    neutral: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>{children}</span>
  );
}

/** Euros the way a French user reads them: 168 000 €. */
export function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** 2026-10-31 → 31 octobre 2026. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
