import { apiClient } from './client';
import type { CompetencyCategoryWire } from '../utils/competencyLeaves';

export interface ICompetencyFrameworkSummary {
  identifier: string;
  name: string;
}

export interface ICompetencyFramework {
  identifier: string;
  name?: string;
  categories?: CompetencyCategoryWire[];
}

/**
 * Live competency (skill) frameworks of a channel. These are `CompetencyFramework` objects, not
 * `Framework`s, so they never appear in `channel.frameworks` or the Course Type list.
 */
export async function listCompetencyFrameworks(channel?: string): Promise<ICompetencyFrameworkSummary[]> {
  const response = await apiClient.post('/action/composite/v3/search', {
    request: {
      filters: {
        objectType: ['CompetencyFramework'],
        status: ['Live'],
        ...(channel ? { channel: [channel] } : {}),
      },
      fields: ['identifier', 'name'],
      limit: 100,
      sort_by: { name: 'asc' },
    },
  });
  const list = (response.data?.result?.CompetencyFramework ?? []) as ICompetencyFrameworkSummary[];
  return list.map((f) => ({ identifier: f.identifier, name: f.name || f.identifier }));
}

/**
 * Reads a competency framework with its categories and terms. `/framework/v1/read` answers 404
 * for `CompetencyFramework` objects, so this uses the competency-framework read (as lern does).
 */
export async function getCompetencyFramework(frameworkId: string): Promise<ICompetencyFramework> {
  const response = await apiClient.get(
    `/action/competency-framework/v3/read/${encodeURIComponent(frameworkId)}`,
  );
  return response.data?.result?.framework as ICompetencyFramework;
}

export interface ICompetencyRole {
  id: string;
  name: string;
  /** Leaf skill codes the role requires. */
  skills: string[];
}

/**
 * Live roles of a competency framework, from lern's `role_skill` (roles don't live in the
 * framework). lern answers 404 when the framework has no roles yet; that is "no roles", not an
 * error.
 */
export async function listCompetencyRoles(frameworkId: string): Promise<ICompetencyRole[]> {
  try {
    const response = await apiClient.get(
      `/action/competency/v1/role/list/${encodeURIComponent(frameworkId)}`,
    );
    const result = (response.data?.result ?? {}) as {
      roles?: Record<string, string[]>;
      roleNames?: Record<string, string>;
    };
    return Object.entries(result.roles ?? {})
      .map(([id, skills]) => ({ id, name: result.roleNames?.[id] || id, skills: skills ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status === 404) return [];
    throw e;
  }
}
