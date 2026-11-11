import { useQuery } from '@tanstack/react-query';
import { getCompetencyFramework, listCompetencyFrameworks, listCompetencyRoles } from '../api/competencyFramework';
import type { ICompetencyFrameworkSummary, ICompetencyRole } from '../api/competencyFramework';
import { competencyLeafSkills, type CompetencySkill } from '../utils/competencyLeaves';

const NO_FRAMEWORKS: ICompetencyFrameworkSummary[] = [];
const NO_SKILLS: CompetencySkill[] = [];
const NO_ROLES: ICompetencyRole[] = [];

/** The channel's Live competency frameworks — options for the "Skill framework" field. */
export function useCompetencyFrameworks(channel: string | undefined, enabled = true): {
  frameworks: ICompetencyFrameworkSummary[];
  isLoaded: boolean;
} {
  const query = useQuery({
    queryKey: ['competency-frameworks', channel ?? ''],
    queryFn: () => listCompetencyFrameworks(channel),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
  return { frameworks: query.data ?? NO_FRAMEWORKS, isLoaded: query.isSuccess };
}

/** Leaf skills of one competency framework — options for the course's Skills field. */
export function useCompetencySkills(frameworkId: string | undefined): {
  skills: CompetencySkill[];
  isLoaded: boolean;
} {
  const query = useQuery({
    queryKey: ['competency-framework', frameworkId],
    queryFn: () => getCompetencyFramework(frameworkId!),
    enabled: !!frameworkId,
    staleTime: 5 * 60 * 1000,
    select: (fw) => competencyLeafSkills(fw?.categories),
  });
  return { skills: query.data ?? NO_SKILLS, isLoaded: query.isSuccess };
}

/** Live roles of one competency framework, each with its required skill codes. */
export function useCompetencyRoles(frameworkId: string | undefined): {
  roles: ICompetencyRole[];
  isLoaded: boolean;
} {
  const query = useQuery({
    queryKey: ['competency-roles', frameworkId],
    queryFn: () => listCompetencyRoles(frameworkId!),
    enabled: !!frameworkId,
    staleTime: 5 * 60 * 1000,
  });
  return { roles: query.data ?? NO_ROLES, isLoaded: query.isSuccess };
}
