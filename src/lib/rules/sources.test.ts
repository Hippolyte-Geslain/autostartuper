import { describe, it, expect } from 'vitest';
import { isOfficialSource, OFFICIAL_SUFFIXES } from './sources';

describe('isOfficialSource', () => {
  it.each([
    ['https://entreprendre.service-public.fr/vosdroits/F32353', 'subdomain of service-public.fr'],
    ['https://www.impots.gouv.fr/professionnel/x', 'subdomain of gouv.fr'],
    ['https://www.autoentrepreneur.urssaf.fr/', 'subdomain of urssaf.fr'],
    ['https://www.inpi.fr/', 'subdomain of inpi.fr'],
    ['https://www.insee.fr/fr/statistiques/1234', 'subdomain of insee.fr'],
    ['https://gouv.fr/', 'bare apex domain'],
    ['https://inpi.fr/', 'bare apex domain'],
  ])('accepts %s (%s)', (url) => {
    expect(isOfficialSource(url)).toBe(true);
  });

  it.each([
    ['https://example.com/gouv.fr', 'official domain only in the path'],
    ['https://evilgouv.fr/', 'no dot boundary before the suffix'],
    ['https://x.gouv.fr.evil.com/', 'official domain only in a left-hand label'],
    ['https://notgouv.fr/', 'suffix is a substring, not a label boundary'],
    ['http://www.impots.gouv.fr/x', 'http downgrade'],
    ['htps://www.urssaf.fr/x', 'typo scheme'],
    ['ftp://www.urssaf.fr/x', 'non-https scheme'],
    ['not a url', 'malformed'],
    ['', 'empty string'],
  ])('rejects %s (%s)', (url) => {
    expect(isOfficialSource(url)).toBe(false);
  });

  it('exposes the allowlist so schemas can build their error message', () => {
    expect(OFFICIAL_SUFFIXES).toContain('gouv.fr');
    expect(OFFICIAL_SUFFIXES).toContain('service-public.fr');
    expect(OFFICIAL_SUFFIXES).toContain('urssaf.fr');
    expect(OFFICIAL_SUFFIXES).toContain('inpi.fr');
    expect(OFFICIAL_SUFFIXES).toContain('insee.fr');
  });
});
