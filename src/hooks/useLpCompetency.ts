import { useMemo } from 'react';
import { useEditorStore } from '../store/editor.store';
import { useTreeStore } from '../store/tree.store';
import { useCompetencyRoles, useCompetencySkills } from './useCompetencyFrameworks';
import { getLpCompetencyFramework, getLpTargetRole } from '../utils/lpCompetency';
import type { ICompetencyRole } from '../api/competencyFramework';
import type { ITerm } from '../types/framework';

export interface ILpCompetency {
  /** The LP's competency framework, once it has read as one (a stored `NCF` never does). */
  frameworkId: string | undefined;
  /** Its leaf skills as framework terms (code + name). */
  terms: ITerm[];
  /** The content field skill tags live in for this framework (its last category code). */
  skillField: string | undefined;
  roles: ICompetencyRole[];
  /** The chosen target role, once roles have loaded. */
  role: ICompetencyRole | undefined;
  /** The stored target role code, even before roles load. */
  roleId: string | undefined;
  roleSkills: string[];
}

const NONE: string[] = [];

/** Learning Path skill framework + target role. Inert (all empty) outside the LP profile. */
export function useLpCompetency(): ILpCompetency {
  const isLearningPath = useEditorStore((s) => s.editorProfile.key === 'learningPath');
  const root = useTreeStore((s) => s.treeData[0]);
  const treeCache = useTreeStore((s) => s.treeCache);
  const stored = isLearningPath ? getLpCompetencyFramework(root, treeCache) : undefined;
  const roleId = isLearningPath ? getLpTargetRole(root, treeCache) : undefined;

  const { skills, skillField: loadedSkillField, isLoaded } = useCompetencySkills(stored);
  const frameworkId = stored && isLoaded && skills.length > 0 ? stored : undefined;
  const { roles } = useCompetencyRoles(frameworkId);

  const terms = useMemo<ITerm[]>(
    () => (frameworkId ? skills.map((sk) => ({ identifier: sk.code, code: sk.code, name: sk.name })) : []),
    [frameworkId, skills],
  );
  const role = roleId ? roles.find((r) => r.id === roleId) : undefined;
  const skillField = frameworkId ? loadedSkillField : undefined;

  return { frameworkId, terms, skillField, roles, role, roleId, roleSkills: role?.skills ?? NONE };
}
