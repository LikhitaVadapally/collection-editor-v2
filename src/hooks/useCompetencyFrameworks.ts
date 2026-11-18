import { useQuery } from '@tanstack/react-query';
import { getCompetencyFramework, listCompetencyFrameworks, listCompetencyRoles } from '../api/competencyFramework';
import type { ICompetencyFrameworkSummary, ICompetencyRole } from '../api/competencyFramework';
import { competencyLeafSkills, competencySkillField, type CompetencySkill } from '../utils/competencyLeaves';
import type { ITerm } from '../types/framework';

const NO_FRAMEWORKS: ICompetencyFrameworkSummary[] = [];
const NO_SKILLS: CompetencySkill[] = [];
const NO_ROLES: ICompetencyRole[] = [];
const NO_TERMS: ITerm[] = [];

/** How long a competency framework or its role list is reused before it is read again. */
export const COMPETENCY_STALE_MS = 10 * 60 * 1000;

interface ISkillFrameworkData {
  skills: CompetencySkill[];
  skillField: string | undefined;
  terms: ITerm[];
}

// Module-level so react-query keeps the selected result's identity while the data is unchanged.
function selectSkillFramework(fw: Awaited<ReturnType<typeof getCompetencyFramework>>): ISkillFrameworkData {
  const skills = competencyLeafSkills(fw?.categories);
  return {
    skills,
    skillField: competencySkillField(fw?.categories),
    terms: skills.map((sk) => ({ identifier: sk.code, code: sk.code, name: sk.name })),
  };
}

/** The channel's Live competency frameworks — options for the "Skill framework" field. */
export function useCompetencyFrameworks(channel: string | undefined, enabled = true): {
  frameworks: ICompetencyFrameworkSummary[];
  isLoaded: boolean;
} {
  const query = useQuery({
    queryKey: ['competency-frameworks', channel ?? ''],
    queryFn: () => listCompetencyFrameworks(channel),
    enabled,
    staleTime: COMPETENCY_STALE_MS,
  });
  return { frameworks: query.data ?? NO_FRAMEWORKS, isLoaded: query.isSuccess };
}

/**
 * Skills of one competency framework — options for the Skills field — as terms too, and
 * `skillField`, the content field they are stored in (the framework's last category code; see
 * competencyLeaves). `usableFrameworkId` is the id once it has loaded with at least one skill: a
 * stored id that isn't a competency framework (old content defaults to `NCF`) never becomes usable.
 */
export function useCompetencySkills(frameworkId: string | undefined): {
  skills: CompetencySkill[];
  skillField: string | undefined;
  terms: ITerm[];
  isLoaded: boolean;
  usableFrameworkId: string | undefined;
} {
  const query = useQuery({
    queryKey: ['competency-framework', frameworkId],
    queryFn: () => getCompetencyFramework(frameworkId!),
    enabled: !!frameworkId,
    staleTime: COMPETENCY_STALE_MS,
    select: selectSkillFramework,
  });
  const skills = query.data?.skills ?? NO_SKILLS;
  return {
    skills,
    skillField: query.data?.skillField,
    terms: query.data?.terms ?? NO_TERMS,
    isLoaded: query.isSuccess,
    usableFrameworkId: frameworkId && query.isSuccess && skills.length > 0 ? frameworkId : undefined,
  };
}

/** Live roles of one competency framework, each with its required skill codes. */
export function useCompetencyRoles(frameworkId: string | undefined): { roles: ICompetencyRole[] } {
  const query = useQuery({
    queryKey: ['competency-roles', frameworkId],
    queryFn: () => listCompetencyRoles(frameworkId!),
    enabled: !!frameworkId,
    staleTime: COMPETENCY_STALE_MS,
  });
  return { roles: query.data ?? NO_ROLES };
}
