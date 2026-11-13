import type { INode } from '../types/editor';
import { isAssessmentLevel } from './lpStructure';

/**
 * A Learning Path can be scoped by a competency (skill) framework and, optionally, a target role.
 * lern reads both straight off the collection (`competencyFramework`, `targetRole`) for skill
 * coverage, so the editor stores them under those exact field names.
 */
export const LP_COMPETENCY_FIELD = 'competencyFramework';
export const LP_TARGET_ROLE_FIELD = 'targetRole';
/**
 * Fallback skill field, for when the skill framework hasn't loaded yet. The real field is the
 * framework's last category code (competencySkillField) — `skill` for some frameworks, `cuisine`
 * for another — which is the field lern credits skills from.
 */
export const SKILL_FIELD = 'skill';

function rootValue(
  root: INode | undefined,
  treeCache: Record<string, Record<string, unknown>>,
  field: string,
): string | undefined {
  if (!root) return undefined;
  const cached = treeCache[root.id]?.[field];
  const raw = cached !== undefined ? cached : root.metadata?.[field];
  return typeof raw === 'string' && raw ? raw : undefined;
}

export function getLpCompetencyFramework(
  root: INode | undefined,
  treeCache: Record<string, Record<string, unknown>>,
): string | undefined {
  return rootValue(root, treeCache, LP_COMPETENCY_FIELD);
}

export function getLpTargetRole(
  root: INode | undefined,
  treeCache: Record<string, Record<string, unknown>>,
): string | undefined {
  return rootValue(root, treeCache, LP_TARGET_ROLE_FIELD);
}

/** A course's skill tags (codes), from its own metadata, under the skill framework's field. */
export function courseSkills(
  course: Pick<INode, 'metadata'> | Record<string, unknown> | undefined,
  skillField: string = SKILL_FIELD,
): string[] {
  const meta = (course && 'metadata' in course ? course.metadata : course) as Record<string, unknown> | undefined;
  const raw = meta?.[skillField];
  return Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
}

/**
 * Whether every one of a course's skills is in `allowed` (and it has at least one) — the client
 * side of Knowlg's `subsetOf` search filter, which the Level Library uses.
 */
export function teachesOnly(skills: string[], allowed: string[]): boolean {
  const set = new Set(allowed);
  return skills.length > 0 && skills.every((s) => set.has(s));
}

/**
 * Regular courses under content Levels that teach anything outside the role (or nothing at all).
 * With a target role a path may only carry courses that stay within the role's skills.
 */
export function coursesOutsideRole(root: INode | undefined, roleSkills: string[], skillField?: string): INode[] {
  if (!root || !roleSkills.length) return [];
  return (root.children ?? [])
    .filter((level) => !isAssessmentLevel(level))
    .flatMap((level) => level.children ?? [])
    .filter((course) => !course.metadata?.['isAssessmentCourse'])
    .filter((course) => !teachesOnly(courseSkills(course, skillField), roleSkills));
}

/** Role skills no linked regular course teaches yet (the coverage hint). */
export function roleSkillsNotTaught(root: INode | undefined, roleSkills: string[], skillField?: string): string[] {
  if (!root || !roleSkills.length) return [];
  const taught = new Set(
    (root.children ?? [])
      .filter((level) => !isAssessmentLevel(level))
      .flatMap((level) => level.children ?? [])
      .filter((course) => !course.metadata?.['isAssessmentCourse'])
      .flatMap((course) => courseSkills(course, skillField)),
  );
  return roleSkills.filter((s) => !taught.has(s));
}
