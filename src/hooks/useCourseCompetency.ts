import { useMemo } from 'react';
import { useEditorStore } from '../store/editor.store';
import { useTreeStore } from '../store/tree.store';
import { useCompetencySkills } from './useCompetencyFrameworks';
import { courseSkills, getLpCompetencyFramework } from '../utils/lpCompetency';
import type { INode } from '../types/editor';
import type { ITerm } from '../types/framework';

export interface ICourseCompetency {
  /** The course's skill framework, once it has read as one (a stored `NCF` never does). */
  frameworkId: string | undefined;
  /** The content field skill tags live in for this framework (its last category code). */
  skillField: string | undefined;
  /** The skill codes chosen on the course. */
  skills: string[];
  /** Its leaf skills as framework terms (code + name), to match legacy name tags too. */
  terms: ITerm[];
  /** A skill framework and at least one skill: the Library can show matching content. */
  ready: boolean;
}

const NONE: string[] = [];
const NO_TERMS: ITerm[] = [];
const INERT: ICourseCompetency = { frameworkId: undefined, skillField: undefined, skills: NONE, terms: NO_TERMS, ready: false };

/** The root's metadata with unsaved edits applied, the way SparkMetaForm reads it. */
function effectiveRootMeta(
  root: INode | undefined,
  treeCache: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  if (!root) return {};
  return { ...(root.metadata ?? {}), ...(treeCache[root.id] ?? {}) };
}

/**
 * Whether the tree being edited is a Course — not a Learning Path, an Evaluation Course or any
 * other collection. Only a Course narrows its Library to the content that teaches its skills.
 */
export function isCourseRoot(
  profileKey: string,
  rootMeta: Record<string, unknown>,
  configPrimaryCategory: string | undefined,
): boolean {
  if (profileKey === 'learningPath') return false;
  const primaryCategory = (rootMeta.primaryCategory ?? configPrimaryCategory) as string | undefined;
  return primaryCategory === 'Course';
}

/**
 * A course's skill framework and chosen skills, from its root metadata and the framework as
 * loaded. Pure, so it can be tested without the stores.
 */
export function resolveCourseCompetency(
  isCourse: boolean,
  rootMeta: Record<string, unknown>,
  loaded: { frameworkId: string | undefined; skillField: string | undefined; terms: ITerm[]; isLoaded: boolean },
): ICourseCompetency {
  if (!isCourse) return INERT;
  const { frameworkId: stored, skillField, terms, isLoaded } = loaded;
  const frameworkId = stored && isLoaded && terms.length > 0 ? stored : undefined;
  if (!frameworkId || !skillField) return INERT;
  const skills = courseSkills(rootMeta, skillField);
  return { frameworkId, skillField, skills, terms, ready: skills.length > 0 };
}

/** Course skill framework + chosen skills. Inert (all empty, not ready) for anything but a Course. */
export function useCourseCompetency(): ICourseCompetency {
  const profileKey = useEditorStore((s) => s.editorProfile.key);
  const configPrimaryCategory = useEditorStore(
    (s) => s.editorConfig?.config?.primaryCategory as string | undefined,
  );
  const root = useTreeStore((s) => s.treeData[0]);
  const treeCache = useTreeStore((s) => s.treeCache);
  const rootMeta = useMemo(() => effectiveRootMeta(root, treeCache), [root, treeCache]);
  const isCourse = isCourseRoot(profileKey, rootMeta, configPrimaryCategory);
  const stored = isCourse ? getLpCompetencyFramework(root, treeCache) : undefined;

  const { skills, skillField, isLoaded } = useCompetencySkills(stored);
  const terms = useMemo<ITerm[]>(
    () => skills.map((sk) => ({ identifier: sk.code, code: sk.code, name: sk.name })),
    [skills],
  );

  const resolved = resolveCourseCompetency(isCourse, rootMeta, { frameworkId: stored, skillField, terms, isLoaded });
  const skillsKey = resolved.skills.join('|');
  // Stable identity across renders while nothing relevant changed, so effects keyed on it don't loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => resolved, [resolved.ready, resolved.frameworkId, resolved.skillField, skillsKey, resolved.terms]);
}
