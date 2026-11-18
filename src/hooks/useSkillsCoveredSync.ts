import { useEffect } from 'react';
import { useTreeStore } from '../store/tree.store';
import { useEditorStore } from '../store/editor.store';
import { useSkillCategory } from './useSkillCategory';
import { useLpCompetency } from './useLpCompetency';
import { computeLevelSkills, isAssessmentLevel, resolveSkillsCoveredForSync } from '../utils/lpStructure';
import { toSkillCodes } from '../utils/skillTerms';
import type { INode } from '../types/editor';
import type { ITerm } from '../types/framework';

/**
 * Level id -> the skills its courses teach, for every content Level whose stored skills differ.
 * Pre/post assessment slots are left alone.
 */
export function levelSkillPatches(
  levels: INode[],
  skillCategoryCode: string,
  treeCache: Record<string, Record<string, unknown>>,
  terms?: ITerm[],
): Array<{ id: string; skills: string[] }> {
  return levels.flatMap((lvl) => {
    if (isAssessmentLevel(lvl)) return [];
    const skills = computeLevelSkills(lvl, skillCategoryCode, terms);
    const stored = toSkillCodes(treeCache[lvl.id]?.[skillCategoryCode] ?? lvl.metadata?.[skillCategoryCode], terms);
    const a = [...skills].sort();
    const b = [...stored].sort();
    const same = a.length === b.length && a.every((sk, i) => sk === b[i]);
    return same ? [] : [{ id: lvl.id, skills }];
  });
}

/**
 * Keeps the LP root's own skill-category metadata field in sync with the
 * derived "Skills covered" union (Prior Assessment + every Level's own
 * selection + Outcome Assessment) — so adding a skill to a Level attaches it
 * to the path's own metadata too, not just that Level's. Mounted once from a
 * component that stays mounted for the whole editing session (not
 * UnitContentList, which mounts/unmounts per node selection).
 */
export function useSkillsCoveredSync(): void {
  const isLearningPath = useEditorStore((s) => s.editorProfile.key === 'learningPath');
  const treeData = useTreeStore((s) => s.treeData);
  const treeCache = useTreeStore((s) => s.treeCache);
  const updateNode = useTreeStore((s) => s.updateNode);
  const skillCategory = useSkillCategory();

  // Depend on skillCategory.code (a stable string), not skillCategory itself
  // — useSkillCategory() returns a fresh object literal every render, which
  // would otherwise refire this effect on every SplitBuilderShell render
  // instead of only when the resolved category actually changes.
  const skillCategoryCode = skillCategory?.code;
  // Terms (framework data, stable across renders) normalise legacy name tags
  // to codes, so the root mirror is written as codes.
  const skillTerms = skillCategory?.terms;
  // With a target role the path's skills are the role's (see resolveSkillsCoveredForSync).
  const { roleSkills } = useLpCompetency();

  // Each content Level stores the skills its courses teach (computeLevelSkills) under the same
  // field, so the saved Level never disagrees with its courses. These writes are derived, not
  // edits: they are silent, so opening a path never marks it unsaved. They go out with the next
  // real save, which a course add/remove (the only way a Level's skills change) always triggers.
  useEffect(() => {
    if (!isLearningPath || !skillCategoryCode) return;
    levelSkillPatches(treeData[0]?.children ?? [], skillCategoryCode, treeCache, skillTerms)
      .forEach(({ id, skills }) => updateNode(id, { [skillCategoryCode]: skills }, [skillCategoryCode], { silent: true }));
  }, [isLearningPath, treeData, treeCache, skillCategoryCode, skillTerms, updateNode]);

  useEffect(() => {
    if (!isLearningPath || !skillCategoryCode) return;
    const root = treeData[0];
    const toSync = resolveSkillsCoveredForSync(root, skillCategoryCode, treeCache, skillTerms, roleSkills);
    if (toSync === null) return;
    // Derived from the Levels and the target role, so silent for the same reason as above.
    updateNode(root!.id, { [skillCategoryCode]: toSync }, [skillCategoryCode], { silent: true });
  }, [isLearningPath, treeData, treeCache, skillCategoryCode, skillTerms, roleSkills, updateNode]);
}
