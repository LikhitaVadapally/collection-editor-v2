import { useEditorStore } from '../store/editor.store';
import { useTreeStore } from '../store/tree.store';
import { useCompetencyRoles, useCompetencySkills } from './useCompetencyFrameworks';
import { getRootCompetencyFramework, getRootTargetRole } from '../utils/lpCompetency';
import type { ITerm } from '../types/framework';

export interface ILpCompetency {
  /** The LP's competency framework, once it has read as one (a stored `NCF` never does). */
  frameworkId: string | undefined;
  /** Its leaf skills as framework terms (code + name). */
  terms: ITerm[];
  /** The content field skill tags live in for this framework (its last category code). */
  skillField: string | undefined;
  /** The chosen target role's skill codes; empty with no role, or before roles load. */
  roleSkills: string[];
}

const NONE: string[] = [];
const NO_TERMS: ITerm[] = [];

/** Learning Path skill framework + target role. Inert (all empty) outside the LP profile. */
export function useLpCompetency(): ILpCompetency {
  const isLearningPath = useEditorStore((s) => s.editorProfile.key === 'learningPath');
  const root = useTreeStore((s) => s.treeData[0]);
  const treeCache = useTreeStore((s) => s.treeCache);
  const stored = isLearningPath ? getRootCompetencyFramework(root, treeCache) : undefined;
  const roleId = isLearningPath ? getRootTargetRole(root, treeCache) : undefined;

  const { usableFrameworkId: frameworkId, skillField, terms } = useCompetencySkills(stored);
  const { roles } = useCompetencyRoles(frameworkId);
  const role = roleId ? roles.find((r) => r.id === roleId) : undefined;

  return {
    frameworkId,
    terms: frameworkId ? terms : NO_TERMS,
    skillField: frameworkId ? skillField : undefined,
    roleSkills: role?.skills ?? NONE,
  };
}
