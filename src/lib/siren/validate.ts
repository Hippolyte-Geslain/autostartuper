/**
 * SIREN sanity checks that need no network.
 *
 * A SIREN is nine digits with a Luhn check digit, so a typo is usually
 * detectable before asking the registry. Doing it here means a mistyped number
 * gets "ce numéro n'est pas un SIREN valide" instantly instead of "entreprise
 * introuvable" after a round trip — a different problem with a different fix.
 */

/** Digits only, so a user pasting "830 141 321" or "830-141-321" is understood. */
export function normalizeSiren(input: string): string {
  return input.replace(/\D/g, '');
}

/** Luhn, the checksum the SIREN carries in its ninth digit. */
function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    // Doubling runs from the right; for a nine-digit SIREN that is every
    // second digit starting at index 1.
    const fromRight = digits.length - 1 - i;
    let d = Number(digits[i]);
    if (fromRight % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * Whether `input` can be a SIREN at all.
 *
 * La Poste's 356000000 is the documented exception: it is a real SIREN that
 * fails Luhn. Rejecting it would lock out a real business, so it is allowed
 * through by name rather than by weakening the check for everyone.
 */
export function isValidSiren(input: string): boolean {
  const digits = normalizeSiren(input);
  if (!/^\d{9}$/.test(digits)) return false;
  if (digits === '356000000') return true;
  return luhnValid(digits);
}
