import { useMemo } from 'react';
import { useTreeStore } from '../store/tree.store';
import { isAssessmentLevel } from '../utils/lpStructure';
import { useSkillCategory, type ISkillCategory } from './useSkillCategory';
import { toSkillCodes } from '../utils/skillTerms';
import type { INode } from '../types/editor';

export interface ISkillScope {
  scope: string[];
  source: 'prior' | 'manual';
}

/**
 * LP skill scope, sole source of truth: the prior assessment's skill-category
 * tags when one is linked; otherwise every Level falls back to manual
 * selection from the framework's full skill catalog. Never derived from
 * linked courses or their content (learning_path_plan.md §3 item 1).
 */
export function resolveSkillScope(
  rootNode: INode | undefined,
  skillCategory: ISkillCategory | null,
  treeCache: Record<string, Record<string, unknown>>,
): ISkillScope {
  // Scope is expressed as term codes; a prior course's tags may be legacy
  // names, so they're normalised before any comparison against it.
  const manual: ISkillScope = { scope: (skillCategory?.terms ?? []).map((t) => t.code), source: 'manual' };
  if (!skillCategory) return manual;

  const preLevel = rootNode?.children?.[0];
  if (!isAssessmentLevel(preLevel)) return manual;

  const priorCourse = preLevel?.children?.[0];
  if (!priorCourse) return manual;
  const cached = treeCache[priorCourse.id]?.[skillCategory.code] as string[] | undefined;
  const raw = (cached ?? priorCourse.metadata?.[skillCategory.code]) as string[] | string | undefined;
  return { scope: toSkillCodes(raw, skillCategory.terms), source: 'prior' };
}

export function useSkillScope(): ISkillScope {
  const skillCategory = useSkillCategory();
  const treeData = useTreeStore((s) => s.treeData);
  const treeCache = useTreeStore((s) => s.treeCache);

  return useMemo(
    () => resolveSkillScope(treeData[0], skillCategory, treeCache),
    [treeData, skillCategory, treeCache],
  );
}
