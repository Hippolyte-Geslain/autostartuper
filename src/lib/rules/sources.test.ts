import { describe, it, expect } from 'vitest';
import { isOfficialSource } from './sources';

describe('isOfficialSource', () => {
  it('accepts official domains', () => {
    expect(isOfficialSource('https://entreprendre.service-public.fr/vosdroits/F32353')).toBe(true);
    expect(isOfficialSource('https://www.impots.gouv.fr/professionnel/x')).toBe(true);
    expect(isOfficialSource('https://www.autoentrepreneur.urssaf.fr/')).toBe(true);
    expect(isOfficialSource('https://www.inpi.fr/')).toBe(true);
  });
  it('rejects non-official or malformed', () => {
    expect(isOfficialSource('https://example.com/gouv.fr')).toBe(false);
    expect(isOfficialSource('https://evilgouv.fr/')).toBe(false); // no dot boundary
    expect(isOfficialSource('not a url')).toBe(false);
  });
});
