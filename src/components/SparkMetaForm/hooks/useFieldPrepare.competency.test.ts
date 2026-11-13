import { describe, it, expect } from 'vitest';
import { adaptCompetencyFields, adaptLpCompetencyFields, useFieldPrepare } from './useFieldPrepare';
import type { PreparedField } from './useFieldPrepare';
import type { ICompetencyTagging, IFrameworkDetails } from '../../../types/framework';

const find = (fields: PreparedField[], code: string) => fields.find(f => f.code === code);

const competency: ICompetencyTagging = {
  frameworks: [
    { label: 'Health Competency', value: 'fw_health' },
    { label: 'Culinary Arts', value: 'fw_culinary' },
  ],
  frameworksLoaded: true,
  skills: [
    { code: 'hand-hygiene', name: 'Hand hygiene' },
    { code: 'ppe-use', name: 'PPE use' },
  ],
};

// A curriculum (USF) skill field already on the form — writes to the same `skill` field.
const usfSkill: PreparedField = {
  code: 'skill', label: 'Skill', inputType: 'multiselect', tab: 'details',
  section: 'Organisation Framework Terms', isSkillField: true,
  options: [{ label: 'Python', value: 'python' }],
};
const name: PreparedField = { code: 'name', label: 'Name', inputType: 'text', tab: 'details' };

describe('adaptCompetencyFields', () => {
  it('adds an unselected Skill framework field and keeps the curriculum skill field when none is picked', () => {
    const fields = adaptCompetencyFields([name, usfSkill], competency, {}, {});
    const fw = find(fields, 'competencyFramework');
    expect(fw).toMatchObject({ inputType: 'select', section: 'Skills', currentValue: undefined });
    expect(fw?.options).toEqual(competency.frameworks);
    expect(find(fields, 'skill')).toBe(usfSkill);
  });

  it('replaces the skill field with the picked framework\'s leaf skills, as codes', () => {
    const fields = adaptCompetencyFields([name, usfSkill], competency, {
      competencyFramework: 'fw_health', skill: ['Hand hygiene', 'ppe-use'],
    }, {});
    expect(find(fields, 'competencyFramework')?.currentValue).toBe('fw_health');
    const skill = find(fields, 'skill');
    expect(skill).toMatchObject({ label: 'Skills', inputType: 'multiselect', section: 'Skills', isSkillField: true });
    expect(skill?.options).toEqual([
      { label: 'Hand hygiene', value: 'hand-hygiene' },
      { label: 'PPE use', value: 'ppe-use' },
    ]);
    // A legacy name tag is normalised to its code.
    expect(skill?.currentValue).toEqual(['hand-hygiene', 'ppe-use']);
    expect(fields.filter(f => f.code === 'skill')).toHaveLength(1);
  });

  it('shows a stored id that is not one of the channel\'s competency frameworks (e.g. NCF) as unselected', () => {
    const fields = adaptCompetencyFields([name, usfSkill], competency, { competencyFramework: 'NCF' }, {});
    expect(find(fields, 'competencyFramework')?.currentValue).toBeUndefined();
    expect(find(fields, 'skill')).toBe(usfSkill);
  });

  it('keeps a stored skill code the framework no longer has, so it is not dropped silently', () => {
    const fields = adaptCompetencyFields([], competency, { competencyFramework: 'fw_health', skill: ['retired-skill'] }, {});
    expect(find(fields, 'skill')?.options).toContainEqual({ label: 'retired-skill', value: 'retired-skill' });
  });

  it('writes the skills to the framework\'s own field (its last category code), not always `skill`', () => {
    const culinary: ICompetencyTagging = { ...competency, skills: [{ code: 'FR2', name: 'French' }], skillField: 'cuisine' };
    const fields = adaptCompetencyFields([name, usfSkill], culinary, { competencyFramework: 'fw_culinary', cuisine: ['FR2'] }, {});
    expect(find(fields, 'cuisine')).toMatchObject({
      label: 'Skills', inputType: 'multiselect', sourceCategory: 'cuisine', isSkillField: true, currentValue: ['FR2'],
    });
    // The curriculum `skill` field is a different field here, so it stays.
    expect(find(fields, 'skill')).toBe(usfSkill);
  });

  it('adds nothing when the channel has no competency frameworks', () => {
    const none = { ...competency, frameworks: [] };
    expect(adaptCompetencyFields([name, usfSkill], none, {}, {})).toEqual([name, usfSkill]);
  });

  it('makes both fields read-only in review mode unless editableFields allows them', () => {
    const fields = adaptCompetencyFields([], competency, { competencyFramework: 'fw_health' }, { editorMode: 'review' });
    expect(find(fields, 'competencyFramework')?.editable).toBe(false);
    expect(find(fields, 'skill')?.editable).toBe(false);
  });
});

describe('useFieldPrepare with competency tagging', () => {
  it('applies it to the root form only', () => {
    const fw: IFrameworkDetails = { competency };
    const form = [{ code: 'name', label: 'Name', inputType: 'text' }];
    expect(find(useFieldPrepare(form, {}, fw, true), 'competencyFramework')).toBeDefined();
    expect(find(useFieldPrepare(form, {}, fw, false), 'competencyFramework')).toBeUndefined();
  });

  it('is absent when the form has no competency details (not a Course root)', () => {
    const form = [{ code: 'name', label: 'Name', inputType: 'text' }];
    expect(find(useFieldPrepare(form, {}, {}, true), 'competencyFramework')).toBeUndefined();
  });
});

describe('adaptLpCompetencyFields', () => {
  const lp: ICompetencyTagging = { ...competency, roles: [{ label: 'ICU Nurse', value: 'icu-nurse' }] };
  const curriculum: PreparedField = {
    code: 'framework', label: 'Curriculum', inputType: 'select', tab: 'details',
    section: 'Organisation Framework Terms', required: true,
  };

  it('adds only the Skill framework field until one is picked', () => {
    const fields = adaptLpCompetencyFields([curriculum], lp, {}, {});
    expect(fields.map(f => f.code)).toEqual(['framework', 'competencyFramework']);
    expect(find(fields, 'framework')?.required).toBe(true);
  });

  it('adds an optional Target role with a "No target role" choice, and relaxes the Curriculum', () => {
    const fields = adaptLpCompetencyFields([curriculum], lp, { competencyFramework: 'fw_health', targetRole: 'icu-nurse' }, {});
    const role = find(fields, 'targetRole');
    expect(role?.options).toEqual([{ label: 'No target role', value: '' }, { label: 'ICU Nurse', value: 'icu-nurse' }]);
    expect(role?.currentValue).toBe('icu-nurse');
    expect(role?.required).toBeFalsy();
    expect(find(fields, 'framework')?.required).toBe(false);
  });

  it('shows a stored role that the framework no longer has as unselected', () => {
    const fields = adaptLpCompetencyFields([], lp, { competencyFramework: 'fw_health', targetRole: 'gone' }, {});
    expect(find(fields, 'targetRole')?.currentValue).toBeUndefined();
  });

  it('omits Target role when the framework has no roles', () => {
    const fields = adaptLpCompetencyFields([], { ...lp, roles: [] }, { competencyFramework: 'fw_health' }, {});
    expect(find(fields, 'targetRole')).toBeUndefined();
  });
});
