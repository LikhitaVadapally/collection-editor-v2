import type { ITerm } from '../types/framework';

/**
 * Skill values are SAVED as framework term codes, but older content carries
 * term names (e.g. 'Data literacy'). Resolve either form to its term the same
 * way lern-service and the portal do: exact code first, then a
 * case-insensitive name match. Names are ambiguous when two terms share one,
 * which is why the editor normalises to codes on write.
 */
export function findSkillTerm(value: string, terms: ITerm[] | undefined): ITerm | undefined {
  if (!terms?.length) return undefined;
  const byCode = terms.find((t) => t.code === value);
  if (byCode) return byCode;
  const lower = value.toLowerCase();
  return terms.find((t) => t.name?.toLowerCase() === lower);
}

/** A stored skill value as its term code — unchanged when no term matches
 *  (e.g. the framework hasn't loaded yet), so nothing is silently dropped. */
export function toSkillCode(value: string, terms: ITerm[] | undefined): string {
  return findSkillTerm(value, terms)?.code ?? value;
}

/** A stored skill field (array, scalar or empty) as de-duplicated term codes. */
export function toSkillCodes(raw: unknown, terms: ITerm[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : [];
  return Array.from(new Set(values.map((v) => toSkillCode(String(v), terms))));
}

/** Display label for a stored skill value: the term name, whether the value
 *  is a code or a legacy name; falls back to the raw value. */
export function skillLabel(value: string, terms: ITerm[] | undefined): string {
  return findSkillTerm(value, terms)?.name ?? value;
}

/** Search-filter values for the given skills: each term's code AND name, so
 *  courses tagged either way (legacy names, or codes going forward) match. */
export function skillFilterValues(values: string[], terms: ITerm[] | undefined): string[] {
  return Array.from(new Set(values.flatMap((v) => {
    const term = findSkillTerm(v, terms);
    return term ? [term.code, term.name] : [v];
  })));
}
