import { describe, it, expect } from 'vitest';
import {
  courseSkills, coursesOutsideRole, getRootCompetencyFramework, getRootTargetRole, roleSkillsNotTaught, skillsOutsideRole,
} from './lpCompetency';
import type { INode } from '../types/editor';

const course = (id: string, skill: string[], extra: Record<string, unknown> = {}) =>
  ({ id, isFolder: false, metadata: { skill, ...extra }, children: [] }) as unknown as INode;
const level = (id: string, children: INode[]) => ({ id, isFolder: true, children, metadata: {} }) as unknown as INode;

// Prior Assessment (assessment level), two content Levels.
const root = {
  id: 'root', isFolder: true, metadata: { competencyFramework: 'fw_health', targetRole: 'nurse' },
  children: [
    level('pre', [course('prior', ['hand-hygiene'], { isAssessmentCourse: true })]),
    level('l1', [course('c1', ['hand-hygiene', 'ppe-use']), course('c2', ['budget-preparation'])]),
    level('l2', [course('c3', [])]),
  ],
} as unknown as INode;

describe('lpCompetency', () => {
  it('reads the root fields, preferring unsaved edits', () => {
    expect(getRootCompetencyFramework(root, {})).toBe('fw_health');
    expect(getRootTargetRole(root, { root: { targetRole: 'icu' } })).toBe('icu');
    expect(getRootTargetRole(root, { root: { targetRole: '' } })).toBeUndefined();
  });

  it('reads course skills as an array', () => {
    expect(courseSkills(course('x', ['a']))).toEqual(['a']);
    expect(courseSkills({ skill: 'a' })).toEqual(['a']);
    expect(courseSkills({})).toEqual([]);
  });

  it('reads course skills from the skill framework\'s own field when it is not `skill`', () => {
    const fr = { id: 'f', isFolder: false, metadata: { cuisine: ['FR2'], skill: ['other'] }, children: [] } as unknown as INode;
    expect(courseSkills(fr, 'cuisine')).toEqual(['FR2']);
    const lp = { id: 'r', isFolder: true, metadata: {}, children: [level('l', [fr])] } as unknown as INode;
    expect(coursesOutsideRole(lp, ['FR2'], 'cuisine')).toEqual([]);
    expect(roleSkillsNotTaught(lp, ['FR2', 'IT1'], 'cuisine')).toEqual(['IT1']);
  });

  it('skillsOutsideRole lists the skills the role doesn\'t require', () => {
    expect(skillsOutsideRole(['s1', 's4'], ['s1', 's2'])).toEqual(['s4']);
    expect(skillsOutsideRole(['s1'], ['s1', 's2'])).toEqual([]);
    expect(skillsOutsideRole([], ['s1'])).toEqual([]);
  });

  // With a role a path may only carry courses within it: c1 teaches hand-hygiene too, c2 nothing
  // of the role. c3 is untagged (validation reports it as missing a tag) and the Prior Assessment
  // is never flagged.
  it('flags regular courses teaching a skill outside the role, never untagged ones or the Prior Assessment', () => {
    expect(coursesOutsideRole(root, ['ppe-use', 'sterile-field']).map(c => c.id)).toEqual(['c1', 'c2']);
    expect(coursesOutsideRole(root, ['hand-hygiene', 'ppe-use', 'budget-preparation'])).toEqual([]);
    expect(coursesOutsideRole(root, [])).toEqual([]);
  });

  it('matches courses tagged by skill name against the role\'s codes', () => {
    const terms = [
      { identifier: 'crop-survey', code: 'crop-survey', name: 'Crop Survey' },
      { identifier: 'soil-sampling', code: 'soil-sampling', name: 'Soil Sampling' },
    ];
    const lp = { id: 'r', isFolder: true, metadata: {}, children: [level('l', [course('old', ['Crop Survey'])])] } as unknown as INode;
    expect(courseSkills(course('old', ['Crop Survey']), 'skill', terms)).toEqual(['crop-survey']);
    expect(coursesOutsideRole(lp, ['crop-survey'], 'skill', terms)).toEqual([]);
    expect(roleSkillsNotTaught(lp, ['crop-survey', 'soil-sampling'], 'skill', terms)).toEqual(['soil-sampling']);
  });

  it('lists role skills no regular course teaches (the Prior Assessment does not count)', () => {
    expect(roleSkillsNotTaught(root, ['hand-hygiene', 'ppe-use', 'sterile-field'])).toEqual(['sterile-field']);
  });
});
