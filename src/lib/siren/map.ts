/**
 * Turns a registry record into what the app can honestly claim about a user.
 *
 * The guiding rule: **the registry is not asked what it does not know.** It
 * knows the legal category, the creation date and the APE code. It does not
 * know whether an entrepreneur individuel opted for the micro regime — that is
 * a tax choice, invisible in the register — and an APE code describes an
 * activity, not the vente / service-BIC / service-BNC split the thresholds turn
 * on. Guessing either would silently produce a wrong plafond for someone.
 *
 * So the mapper returns *candidates*, and anything it cannot settle stays a
 * question in the wizard.
 */
import type { LegalForm } from '../rules/types';

/** What we keep of a registry record. */
export interface RegistryCompany {
  siren: string;
  name: string;
  /** Creation date, `YYYY-MM-DD`. Feeds `derivePhase`. */
  registeredOn?: string;
  /** APE/NAF code of the head office, e.g. `62.09Z`. Shown, never interpreted. */
  apeCode?: string;
  /** INSEE catégorie juridique, e.g. `1000`, `5720`. */
  natureJuridique?: string;
  /** `false` once the business is closed — the registry's `etat_administratif`. */
  active: boolean;
  closedOn?: string;
  /**
   * The v1 legal forms this record could be.
   *
   * - exactly one → the wizard confirms it rather than asking.
   * - several → a real question ("micro ou EI ?").
   * - none → a form v1 does not cover (a multi-associate SARL, an association…).
   */
  legalFormCandidates: LegalForm[];
}

/**
 * INSEE catégorie juridique → what it can mean in v1's vocabulary.
 *
 * `1000` is a personne physique: entrepreneur individuel, with or without the
 * micro regime. Both, therefore.
 *
 * `5720` is the SAS à associé unique — a SASU, unambiguously.
 *
 * Everything under `54xx` is the SARL family. An EURL is a SARL with a single
 * associate, not a separate category, so the register cannot tell an EURL from
 * a two-associate SARL. `eurl` is offered as the only v1 candidate and the
 * wizard confirms it; if the user says otherwise they fall outside v1.
 *
 * Anything else (SAS with several associates, SA, association, collectivité) is
 * outside solo-founder v1 and yields no candidate at all.
 */
export function legalFormCandidates(natureJuridique?: string): LegalForm[] {
  if (!natureJuridique) return [];
  if (natureJuridique === '1000') return ['micro', 'ei'];
  if (natureJuridique === '5720') return ['sasu'];
  if (natureJuridique.startsWith('54')) return ['eurl'];
  return [];
}

/** The subset of the API payload this app reads. Everything else is ignored. */
export interface RegistryPayload {
  siren?: unknown;
  nom_complet?: unknown;
  nom_raison_sociale?: unknown;
  date_creation?: unknown;
  date_fermeture?: unknown;
  activite_principale?: unknown;
  nature_juridique?: unknown;
  etat_administratif?: unknown;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Maps one API result. Returns `null` if the record has no SIREN, which is the
 * only field nothing downstream can work without.
 *
 * `etat_administratif` is `'A'` for active and `'C'` for cessée. Anything else
 * — including the field being absent — is treated as **not** active: a closed
 * business shown as open would be handed a roadmap of obligations it no longer
 * owes, which is worse than asking the user to confirm.
 */
export function mapCompany(payload: RegistryPayload): RegistryCompany | null {
  const siren = str(payload.siren);
  if (!siren) return null;
  return {
    siren,
    name: str(payload.nom_complet) ?? str(payload.nom_raison_sociale) ?? siren,
    registeredOn: str(payload.date_creation),
    apeCode: str(payload.activite_principale),
    natureJuridique: str(payload.nature_juridique),
    active: payload.etat_administratif === 'A',
    closedOn: str(payload.date_fermeture),
    legalFormCandidates: legalFormCandidates(str(payload.nature_juridique)),
  };
}
