import { describe, it, expect } from 'vitest';
import { buildLpLibraryFilters, resolveBrowseSkills, buildSearchFields, computeLibraryEmptyReason, buildCourseLibraryFilters, isCourseSkillMatch, courseLibraryHint, lpCompetencyScope, appendOtherPage, latestRequestGuard } from './useLibrary';
import type { IContent } from '../types/content';
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
  it("asks a Course's search for each item's skill framework and skill field (positive)", () => {
    expect(buildSearchFields(false, undefined, 'cuisine')).toEqual([...DEFAULT_SEARCH_FIELDS, 'cuisine', 'competencyFramework']);
  });

  it('keeps the default fields for a collection with no skill framework (negative)', () => {
    expect(buildSearchFields(false, undefined, undefined)).toBeUndefined();
  });

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
  const competency = { frameworkId: 'fw_health', roleSkillValues: ['hand-hygiene', 'ppe-use'] };

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
    const f = buildLpLibraryFilters('pre', true, [], 'skill', undefined, { frameworkId: 'fw_health', roleSkillValues: [] });
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

  it("matches content in the course's skill framework whose skills all lie within the course's, under the framework's own field", () => {
    expect(buildCourseLibraryFilters('culinary_test', 'cuisine', ['cuisine-french'], terms)).toEqual({
      competencyFramework: ['culinary_test'],
      cuisine: { subsetOf: ['cuisine-french', 'French Cuisine'] },
    });
  });

  // Regression: a plain "any of" list offered content that also teaches skills outside the course.
  it('uses subsetOf, not a plain "any of" list, so content teaching another skill too is left out', () => {
    const filters = buildCourseLibraryFilters('culinary_test', 'cuisine', ['cuisine-french', 'cuisine-italian'], terms);
    expect(Array.isArray(filters.cuisine)).toBe(false);
    expect(filters.cuisine).toEqual({ subsetOf: ['cuisine-french', 'French Cuisine', 'cuisine-italian', 'Italian Cuisine'] });
  });

  it('keeps a skill the framework no longer lists as-is', () => {
    expect(buildCourseLibraryFilters('fw', 'skill', ['retired'], terms)).toEqual({
      competencyFramework: ['fw'],
      skill: { subsetOf: ['retired'] },
    });
  });
});

describe('isCourseSkillMatch', () => {
  const values = ['fe_sk_unit', 'Write Unit Tests'];

  it('is a match when every skill tag is one of the course skills, in its framework', () => {
    expect(isCourseSkillMatch({ competencyFramework: 'fe', skill: ['fe_sk_unit'] }, 'fe', 'skill', values)).toBe(true);
    expect(isCourseSkillMatch({ competencyFramework: 'fe', skill: ['Write Unit Tests'] }, 'fe', 'skill', values)).toBe(true);
  });

  // Regression: content that also teaches other skills must land in Other content, not vanish.
  it('is not a match when the content also teaches a skill outside the course', () => {
    expect(isCourseSkillMatch({ competencyFramework: 'fe', skill: ['fe_sk_unit', 'fe_sk_e2e'] }, 'fe', 'skill', values)).toBe(false);
  });

  it('is not a match in another framework or with no framework', () => {
    expect(isCourseSkillMatch({ competencyFramework: 'other', skill: ['fe_sk_unit'] }, 'fe', 'skill', values)).toBe(false);
    expect(isCourseSkillMatch({ name: 'untagged' }, 'fe', 'skill', values)).toBe(false);
  });

  it('reads a single string tag too', () => {
    expect(isCourseSkillMatch({ competencyFramework: 'fe', skill: 'fe_sk_unit' }, 'fe', 'skill', values)).toBe(true);
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

describe('lpCompetencyScope', () => {
  const terms = [{ identifier: 'crop-survey', code: 'crop-survey', name: 'Crop Survey' }];

  it('searches the role\'s skills by code and name, so name-tagged assessment courses match (positive)', () => {
    expect(lpCompetencyScope('agro', ['crop-survey'], terms)).toEqual({ frameworkId: 'agro', roleSkillValues: ['crop-survey', 'Crop Survey'] });
  });

  it('is absent without a usable skill framework (negative)', () => {
    expect(lpCompetencyScope(undefined, ['crop-survey'], terms)).toBeUndefined();
  });
});

describe('appendOtherPage', () => {
  const item = (identifier: string) => ({ identifier, name: identifier }) as IContent;

  it('replaces the list on the first page (positive)', () => {
    expect(appendOtherPage([item('a')], [item('b')], 0)).toEqual({ content: [item('b')], nextOffset: 1 });
  });

  it('pages on from what the server returned even when a repeat is dropped (positive)', () => {
    const page = appendOtherPage([item('a'), item('b')], [item('b'), item('c')], 2);
    expect(page.content.map((c) => c.identifier)).toEqual(['a', 'b', 'c']);
    expect(page.nextOffset).toBe(4);
  });
});

describe('latestRequestGuard', () => {
  it('lets only the newest request apply its response (positive)', () => {
    const guard = latestRequestGuard();
    const first = guard.next();
    const second = guard.next();
    expect(guard.isLatest(first)).toBe(false);
    expect(guard.isLatest(second)).toBe(true);
  });

  it('drops a pending request once invalidated (negative)', () => {
    const guard = latestRequestGuard();
    const token = guard.next();
    guard.invalidate();
    expect(guard.isLatest(token)).toBe(false);
  });
});
