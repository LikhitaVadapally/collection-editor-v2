import type { INode } from '../types/editor';
import type { ITerm } from '../types/framework';
import { isAssessmentLevel } from './lpStructure';
import { toSkillCodes } from './skillTerms';

/**
 * A course or Learning Path names its competency (skill) framework, and a Learning Path optionally
 * a target role. lern reads both straight off the collection (`competencyFramework`, `targetRole`)
 * for skill coverage, so the editor stores them under those exact field names.
 */
export const COMPETENCY_FRAMEWORK_FIELD = 'competencyFramework';
export const TARGET_ROLE_FIELD = 'targetRole';
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

export function getRootCompetencyFramework(
  root: INode | undefined,
  treeCache: Record<string, Record<string, unknown>>,
): string | undefined {
  return rootValue(root, treeCache, COMPETENCY_FRAMEWORK_FIELD);
}

export function getRootTargetRole(
  root: INode | undefined,
  treeCache: Record<string, Record<string, unknown>>,
): string | undefined {
  return rootValue(root, treeCache, TARGET_ROLE_FIELD);
}

/**
 * A course's skill tags as term codes, from its own metadata under the skill framework's field.
 * Older content tags by skill name; `terms` resolves those to codes like every other skill check.
 */
export function courseSkills(
  course: Pick<INode, 'metadata'> | Record<string, unknown> | undefined,
  skillField: string = SKILL_FIELD,
  terms?: ITerm[],
): string[] {
  const meta = (course && 'metadata' in course ? course.metadata : course) as Record<string, unknown> | undefined;
  return toSkillCodes(meta?.[skillField], terms);
}

/** The skills among `skills` that the role doesn't require. Empty for an untagged course. */
export function skillsOutsideRole(skills: string[], roleSkills: string[]): string[] {
  const required = new Set(roleSkills);
  return skills.filter((s) => !required.has(s));
}

function regularLevelCourses(root: INode): INode[] {
  return (root.children ?? [])
    .filter((level) => !isAssessmentLevel(level))
    .flatMap((level) => level.children ?? [])
    .filter((course) => !course.metadata?.['isAssessmentCourse']);
}

/**
 * Regular courses under content Levels that teach a skill outside the role. With a target role a
 * path may only carry courses that stay within the role's skills. Untagged courses aren't counted:
 * validation reports them separately as missing a skill tag.
 */
export function coursesOutsideRole(
  root: INode | undefined,
  roleSkills: string[],
  skillField?: string,
  terms?: ITerm[],
): INode[] {
  if (!root || !roleSkills.length) return [];
  return regularLevelCourses(root)
    .filter((course) => skillsOutsideRole(courseSkills(course, skillField, terms), roleSkills).length > 0);
}

/** Role skills no linked regular course teaches yet (the coverage hint). */
export function roleSkillsNotTaught(
  root: INode | undefined,
  roleSkills: string[],
  skillField?: string,
  terms?: ITerm[],
): string[] {
  if (!root || !roleSkills.length) return [];
  const taught = new Set(regularLevelCourses(root).flatMap((course) => courseSkills(course, skillField, terms)));
  return roleSkills.filter((s) => !taught.has(s));
}
