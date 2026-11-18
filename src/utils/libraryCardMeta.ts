import type { IContent } from '../types/content';
import type { ITerm } from '../types/framework';
import { findSkillTerm, skillLabel } from './skillTerms';

/**
 * "<org name> · <category>" for a library card. The org name is the first `organisation` entry;
 * without one only the category shows. The `channel` is never shown: it is an id
 * (e.g. 0146092176054435840), not a name, and used to run straight into the category.
 */
export function cardCaption(item: Pick<IContent, 'organisation' | 'primaryCategory'>): string {
  const org = (item.organisation ?? []).map((o) => String(o ?? '').trim()).find(Boolean) ?? '';
  const category = String(item.primaryCategory ?? '').trim();
  return [org, category].filter(Boolean).join(' · ');
}

export interface ISkillTag {
  /** Shown name: the framework term's name, or the stored value when it isn't a known term. */
  label: string;
  /** One of the course's own skills, highlighted and listed first. */
  matched: boolean;
}

/**
 * A library item's skill tags as card chips: one per skill (a legacy name tag counts the same as
 * its code), labelled with the term's name. The `wanted` skills — the course's own, or the path's
 * target role's — come first, marked `matched`.
 */
export function skillTags(raw: unknown, wanted: string[], terms: ITerm[] | undefined): ISkillTag[] {
  const values = (Array.isArray(raw) ? raw : raw != null && raw !== '' ? [raw] : []).map(String);
  const wantedCodes = new Set(wanted.map((s) => findSkillTerm(s, terms)?.code ?? s));
  const seen = new Set<string>();
  const tags: ISkillTag[] = [];
  for (const v of values) {
    const code = findSkillTerm(v, terms)?.code ?? v;
    if (seen.has(code)) continue;
    seen.add(code);
    tags.push({ label: skillLabel(v, terms), matched: wantedCodes.has(code) });
  }
  return [...tags.filter((t) => t.matched), ...tags.filter((t) => !t.matched)];
}

/**
 * The skills a library item teaches, for its card in a Course's library. Read from the item's own
 * skill field, and only when the item uses the course's skill framework: a code means nothing
 * outside its framework, so another framework's tags are not guessed at.
 */
export function courseSkillTags(
  item: Record<string, unknown>,
  course: { frameworkId: string | undefined; skillField: string | undefined; skills: string[]; terms: ITerm[] },
): ISkillTag[] {
  const { frameworkId, skillField, skills, terms } = course;
  if (!frameworkId || !skillField || item.competencyFramework !== frameworkId) return [];
  return skillTags(item[skillField], skills, terms);
}
