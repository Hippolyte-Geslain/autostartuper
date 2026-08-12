import { describe, it, expect } from 'vitest';
import { extractFiche, extractFigures, diffFiche, ficheIdOf, toText, decodeEntities } from './fiche';
import { coverageOf, rulesCiting } from './coverage';
import { loadRules } from '../rules/loader';
import { readdirSync } from 'node:fs';

const page = (body: string) =>
  `<html><head><title>Régime micro-social | Service Public Entreprendre</title></head><body>
   <nav>Menu Recherche</nav>
   <p>Vérifié le 21 février 2026 - Direction de l'information légale</p>
   ${body}
   <div>Cette page vous a-t-elle été utile ? 1 2 3</div></body></html>`;

describe('decodeEntities', () => {
  it('handles named, decimal and hex entities', () => {
    expect(decodeEntities('caf&eacute; &#233; &#xe9; &amp;')).toBe('café é é &');
  });

  it('leaves an unknown entity alone rather than eating it', () => {
    expect(decodeEntities('&notanentity;')).toBe('&notanentity;');
  });
});

describe('toText', () => {
  it('drops scripts and styles with their contents', () => {
    expect(toText('<p>gardé</p><script>alert("non")</script><style>.a{}</style>')).toBe('gardé');
  });

  it('keeps list items on their own lines', () => {
    expect(toText('<ul><li>un</li><li>deux</li></ul>')).toContain('- un');
  });
});

describe('extractFiche', () => {
  it('takes the title, the verification date and the body between the markers', () => {
    const fiche = extractFiche(page('<p>Le taux est de 21,2 %.</p>'));
    expect(fiche.title).toBe('Régime micro-social');
    expect(fiche.verifiedOn).toBe('21 février 2026');
    expect(fiche.body).toContain('21,2 %');
    expect(fiche.body).not.toContain('Menu Recherche'); // chrome dropped
    expect(fiche.body).not.toContain('utile ?'); // feedback widget dropped
  });

  it('says so rather than inventing a date when the stamp is absent', () => {
    expect(extractFiche('<html><body><p>rien</p></body></html>').verifiedOn).toBe('inconnu');
  });
});

describe('extractFigures', () => {
  it('finds euro amounts and percentages as written', () => {
    expect(extractFigures('Plafond de 203 100 € et taux de 21,2 %.')).toEqual([
      '203 100 €',
      '21,2 %',
    ]);
  });

  it('ignores numbers that are neither', () => {
    expect(extractFigures('Article L526-22 du code de commerce')).toEqual([]);
  });
});

describe('diffFiche', () => {
  const archived = extractFiche(page('<p>Le plafond est de 203 100 € et le taux de 21,2 %.</p>'));

  it('reports no change when only the whitespace moved', () => {
    const reflowed = extractFiche(
      page('<p>Le plafond est de 203 100 €\n\n   et le taux de 21,2 %.</p>')
    );
    expect(diffFiche(archived, reflowed).changed).toBe(false);
  });

  it('catches a changed amount in both directions', () => {
    const fresh = extractFiche(page('<p>Le plafond est de 210 000 € et le taux de 21,2 %.</p>'));
    const diff = diffFiche(archived, fresh);
    expect(diff.changed).toBe(true);
    expect(diff.figuresRemoved).toEqual(['203 100 €']);
    expect(diff.figuresAdded).toEqual(['210 000 €']);
  });

  it('reports a re-verification even when the text is identical', () => {
    const fresh = extractFiche(
      page('<p>Le plafond est de 203 100 € et le taux de 21,2 %.</p>').replace(
        '21 février 2026',
        '3 mars 2026'
      )
    );
    const diff = diffFiche(archived, fresh);
    expect(diff.verifiedOnChanged).toEqual({ from: '21 février 2026', to: '3 mars 2026' });
    expect(diff.figuresRemoved).toEqual([]);
  });

  it('reports prose changes even when no figure moved', () => {
    const fresh = extractFiche(
      '<html><head><title>x</title></head><body><p>Vérifié le 21 février 2026 - x</p><p>Le plafond est de 203 100 € et le taux de 21,2 %. Nouvelle phrase.</p></body></html>'
    );
    expect(diffFiche(archived, fresh).changed).toBe(true);
  });
});

describe('ficheIdOf', () => {
  it.each([
    ['https://entreprendre.service-public.gouv.fr/vosdroits/F23844', 'F23844'],
    ['https://entreprendre.service-public.gouv.fr/vosdroits/F23844?x=1', 'F23844'],
  ])('%s → %s', (url, expected) => {
    expect(ficheIdOf(url)).toBe(expected);
  });

  it('returns nothing for a page with no fiche id', () => {
    expect(ficheIdOf('https://www.impots.gouv.fr/formulaire/1447-c-sd/declaration')).toBeUndefined();
  });
});

describe('coverage of the real rules', () => {
  const rules = loadRules('rules');
  const archived = readdirSync('docs/sources')
    .map((f) => /^(F\d+)/.exec(f)?.[1])
    .filter((f): f is string => Boolean(f));

  it('accounts for every rule exactly once', () => {
    const coverage = coverageOf(rules, archived);
    const total =
      coverage.watched.length + coverage.missing.length + coverage.unsupported.length;
    expect(total).toBe(rules.length);
  });

  it('leaves no service-public source unarchived', () => {
    // The point of the archive: if this fails, a rule just became invisible to
    // the watchdog and somebody must archive its fiche.
    expect(coverageOf(rules, archived).missing).toEqual([]);
  });

  it('lists the impots.gouv.fr sources as known blind spots', () => {
    const { unsupported } = coverageOf(rules, archived);
    expect(unsupported.map((u) => u.ruleId).sort()).toEqual([
      'cfe-paiement',
      'declaration-initiale-cfe',
    ]);
  });

  it('names every rule that a change to one fiche would put in doubt', () => {
    expect(rulesCiting(rules, 'F32353').sort()).toEqual([
      'plafond-micro-services',
      'plafond-micro-vente',
    ]);
  });
});
