import { describe, it, expect } from 'vitest';
import { buildLpLibraryFilters, resolveBrowseSkills, buildSearchFields, computeLibraryEmptyReason, buildCourseLibraryFilters, selectOtherContent, courseLibraryHint } from './useLibrary';
import { DEFAULT_SEARCH_FIELDS } from '../api/content';

describe('buildLpLibraryFilters', () => {
  it('filling the pre/post slot searches Evaluation Course with no competency constraint', () => {
    expect(buildLpLibraryFilters('pre', true, [], 'skill')).toEqual({ primaryCategory: ['Evaluation Course'] });
    expect(buildLpLibraryFilters('post', true, ['Java'], 'skill')).toEqual({ primaryCategory: ['Evaluation Course'] });
  });

  it('picking a Level Exam course (isPickingEvaluationCourse, no slot) still applies the skill-code filter', () => {
    expect(buildLpLibraryFilters(null, true, [], 'skill')).toEqual({ primaryCategory: ['Evaluation Course'] });
    expect(buildLpLibraryFilters(null, true, ['Java'], 'skill')).toEqual({
      primaryCategory: ['Evaluation Course'],
      skill: { subsetOf: ['Java'] },
    });
  });

  it('shows every Course, unfiltered, when browsing a Level with no skills selected yet', () => {
    expect(buildLpLibraryFilters(null, false, [], 'skill')).toEqual({ primaryCategory: ['Course'] });
  });

  // Only courses whose skills all lie within the Level's selection (Knowlg subsetOf).
  it('filters Courses to the ones teaching only the selected skills, under the resolved skill-category code', () => {
    expect(buildLpLibraryFilters(null, false, ['Python programming', 'Java'], 'skill')).toEqual({
      primaryCategory: ['Course'],
      skill: { subsetOf: ['Python programming', 'Java'] },
    });
    expect(buildLpLibraryFilters(null, false, ['cuisine-french'], 'cuisine')).toEqual({
      primaryCategory: ['Course'],
      cuisine: { subsetOf: ['cuisine-french'] },
    });
  });

  it('omits the skill filter key when the skill category has not resolved yet', () => {
    expect(buildLpLibraryFilters(null, false, ['Java'], undefined)).toEqual({ primaryCategory: ['Course'] });
  });

  it("constrains every LP search — slot picker included — to the root's selected framework", () => {
    expect(buildLpLibraryFilters('pre', true, [], 'skill', 'usf')).toEqual({
      primaryCategory: ['Evaluation Course'],
      framework: ['usf'],
    });
    expect(buildLpLibraryFilters(null, false, ['Java'], 'skill', 'usf')).toEqual({
      primaryCategory: ['Course'],
      framework: ['usf'],
      skill: { subsetOf: ['Java'] },
    });
  });
});

describe('buildSearchFields', () => {
  it('appends the resolved skill-category code, framework and competencyFramework for the LP profile', () => {
    expect(buildSearchFields(true, 'skill')).toEqual([...DEFAULT_SEARCH_FIELDS, 'skill', 'framework', 'competencyFramework']);
  });

  it('leaves the default fields untouched for the Collection profile', () => {
    expect(buildSearchFields(false, 'skill')).toBeUndefined();
  });

  it('leaves the default fields untouched when the skill category has not resolved yet', () => {
    expect(buildSearchFields(true, undefined)).toBeUndefined();
  });
});

describe('computeLibraryEmptyReason', () => {
  it('is null for the Collection profile', () => {
    expect(computeLibraryEmptyReason(false, undefined)).toBeNull();
    expect(computeLibraryEmptyReason(false, 'NCF')).toBeNull();
  });

  it('is noCurriculum when the LP root has no skill framework or Curriculum yet', () => {
    expect(computeLibraryEmptyReason(true, undefined)).toBe('noCurriculum');
  });

  it('is null with no Curriculum while picking an Evaluation Course for a slot/Level Exam — that course defines the scope, not the other way around', () => {
    expect(computeLibraryEmptyReason(true, undefined, true)).toBeNull();
  });

  // A Level's skills come from its courses, so a Level with none yet still lists courses.
  it('is null once a Curriculum is set, on a Level with no courses too', () => {
    expect(computeLibraryEmptyReason(true, 'NCF')).toBeNull();
  });
});

describe('buildLpLibraryFilters with a competency framework', () => {
  const competency = { frameworkId: 'fw_health', roleSkills: ['hand-hygiene', 'ppe-use'] };

  it('scopes by competencyFramework instead of the curriculum framework', () => {
    const f = buildLpLibraryFilters(null, false, ['hand-hygiene'], 'skill', 'USF', competency);
    expect(f).toEqual({ primaryCategory: ['Course'], competencyFramework: ['fw_health'], skill: { subsetOf: ['hand-hygiene'] } });
  });

  it('makes the Prior/Outcome Assessment pick test the target role\'s skills', () => {
    const f = buildLpLibraryFilters('pre', true, [], 'skill', undefined, competency);
    expect(f).toEqual({
      primaryCategory: ['Evaluation Course'], competencyFramework: ['fw_health'], skill: ['hand-hygiene', 'ppe-use'],
    });
  });

  it('leaves the assessment pick unfiltered by skill when there is no role', () => {
    const f = buildLpLibraryFilters('pre', true, [], 'skill', undefined, { frameworkId: 'fw_health', roleSkills: [] });
    expect(f).toEqual({ primaryCategory: ['Evaluation Course'], competencyFramework: ['fw_health'] });
  });
});

describe('resolveBrowseSkills', () => {
  it('browses the role\'s skills, else the Prior Assessment\'s', () => {
    expect(resolveBrowseSkills({ scope: ['farmer-counselling'], source: 'role' })).toEqual(['farmer-counselling']);
    expect(resolveBrowseSkills({ scope: ['Java'], source: 'prior' })).toEqual(['Java']);
  });

  it('does not narrow the Library without a role or Prior Assessment', () => {
    expect(resolveBrowseSkills({ scope: ['Java', 'SQL'], source: 'manual' })).toEqual([]);
  });
});

describe('buildCourseLibraryFilters', () => {
  const terms = [
    { identifier: 'cuisine-french', code: 'cuisine-french', name: 'French Cuisine' },
    { identifier: 'cuisine-italian', code: 'cuisine-italian', name: 'Italian Cuisine' },
  ];

  it("matches content in the course's skill framework carrying any of its skills, under the framework's own field", () => {
    expect(buildCourseLibraryFilters('culinary_test', 'cuisine', ['cuisine-french'], terms)).toEqual({
      competencyFramework: ['culinary_test'],
      cuisine: ['cuisine-french', 'French Cuisine'],
    });
  });

  it('uses a plain "any of" list, not subsetOf, so content that also covers other skills still matches', () => {
    const filters = buildCourseLibraryFilters('culinary_test', 'cuisine', ['cuisine-french', 'cuisine-italian'], terms);
    expect(Array.isArray(filters.cuisine)).toBe(true);
    expect(filters.cuisine).toEqual(['cuisine-french', 'French Cuisine', 'cuisine-italian', 'Italian Cuisine']);
  });

  it('keeps a skill the framework no longer lists as-is', () => {
    expect(buildCourseLibraryFilters('fw', 'skill', ['retired'], terms)).toEqual({
      competencyFramework: ['fw'],
      skill: ['retired'],
    });
  });
});

describe('selectOtherContent', () => {
  const item = (identifier: string, meta: Record<string, unknown> = {}) =>
    ({ identifier, name: identifier, mimeType: 'application/pdf', ...meta }) as never;
  const match = ['cuisine-french', 'French Cuisine'];

  it('drops what the first section already shows', () => {
    const out = selectOtherContent([item('a'), item('b')], new Set(['a']), 'culinary_test', 'cuisine', match);
    expect(out.map((c: { identifier: string }) => c.identifier)).toEqual(['b']);
  });

  it("drops content that teaches one of the course's skills, even when the first section is still paged", () => {
    const out = selectOtherContent([
      item('code', { competencyFramework: 'culinary_test', cuisine: ['cuisine-french'] }),
      item('legacy-name', { competencyFramework: 'culinary_test', cuisine: 'French Cuisine' }),
      item('other-skill', { competencyFramework: 'culinary_test', cuisine: ['cuisine-italian'] }),
    ], new Set(), 'culinary_test', 'cuisine', match);
    expect(out.map((c: { identifier: string }) => c.identifier)).toEqual(['other-skill']);
  });

  it('keeps content from another framework or with no skill tags', () => {
    const out = selectOtherContent([
      item('other-fw', { competencyFramework: 'fw_health', cuisine: ['cuisine-french'] }),
      item('untagged'),
    ], new Set(), 'culinary_test', 'cuisine', match);
    expect(out.map((c: { identifier: string }) => c.identifier)).toEqual(['other-fw', 'untagged']);
  });
});

describe('courseLibraryHint', () => {
  it('nudges a Course with no skills yet to pick them', () => {
    expect(courseLibraryHint({ isCourse: true, ready: false })).toBe('pickSkills');
  });

  it('says nothing once the course has skills, or for anything but a Course', () => {
    expect(courseLibraryHint({ isCourse: true, ready: true })).toBeNull();
    expect(courseLibraryHint({ isCourse: false, ready: false })).toBeNull();
  });
});
