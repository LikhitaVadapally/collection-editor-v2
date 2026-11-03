import { describe, it, expect } from 'vitest';
import { useFieldPrepare } from './useFieldPrepare';
import { learningPathProfile } from '../../../types/profile';
import type { IFrameworkDetails } from '../../../types/framework';

const find = (fields: ReturnType<typeof useFieldPrepare>, code: string) => fields.find(f => f.code === code);

const skillTerms = [
  { identifier: 'usf_skill_1', name: 'Data literacy', code: 'data-literacy' },
  { identifier: 'usf_skill_2', name: 'Python basics', code: 'python-basics' },
];

// Skills framework (non-K12): industry/domain/skill.
const usf: IFrameworkDetails = {
  organisationFramework: {
    identifier: 'USF', name: 'USF', code: 'USF',
    categories: [
      { identifier: 'usf_industry', name: 'Industry', code: 'industry', index: 1, terms: [{ identifier: 'i1', name: 'IT', code: 'it' }] },
      { identifier: 'usf_domain', name: 'Domain', code: 'domain', index: 2, terms: [] },
      { identifier: 'usf_skill', name: 'Skill', code: 'skill', index: 3, terms: skillTerms },
    ],
  },
};

// K-12-shaped framework that ALSO carries a skill category (dev mock's NCF).
const k12WithSkill: IFrameworkDetails = {
  organisationFramework: {
    identifier: 'NCF', name: 'NCF', code: 'NCF',
    categories: [
      { identifier: 'ncf_board', name: 'Board', code: 'board', index: 1, terms: [{ identifier: 'b1', name: 'CBSE', code: 'cbse' }] },
      { identifier: 'ncf_skill', name: 'Skill', code: 'skill', index: 5, terms: skillTerms },
    ],
  },
};

// Real NCF: no skill category — its highest-index category is topic.
const ncf: IFrameworkDetails = {
  organisationFramework: {
    identifier: 'NCF', name: 'NCF', code: 'NCF',
    categories: [
      { identifier: 'ncf_board', name: 'Board', code: 'board', index: 1, terms: [] },
      { identifier: 'ncf_topic', name: 'Topic', code: 'topic', index: 5, terms: [{ identifier: 'tp1', name: 'Fractions', code: 'fractions' }] },
    ],
  },
};

const skillField = { code: 'skill', label: 'Skills', section: 'Organisation Framework Terms' };

describe('course skill field (framework skill category)', () => {
  it('binds a form `skill` field to the skill category as a code-valued multiselect, even without sourceCategory/inputType', () => {
    for (const fw of [usf, k12WithSkill]) {
      const f = find(useFieldPrepare([skillField], {}, fw, true, {}), 'skill')!;
      expect(f.inputType).toBe('multiselect');
      expect(f.isSkillField).toBe(true);
      expect(f.options).toEqual([
        { label: 'Data literacy', value: 'data-literacy' },
        { label: 'Python basics', value: 'python-basics' },
      ]);
    }
  });

  it('forces multiselect even when the form declares a single select', () => {
    const cfg = [{ ...skillField, inputType: 'frameworkCategorySelect', sourceCategory: 'skill' }];
    expect(find(useFieldPrepare(cfg, {}, usf, true, {}), 'skill')!.inputType).toBe('multiselect');
  });

  it('normalises legacy name values (case-insensitive) to codes so they show as selected and re-save as codes', () => {
    const f = find(useFieldPrepare([skillField], { skill: ['data literacy', 'python-basics', 'Unknown'] }, usf, true, {}), 'skill')!;
    expect(f.currentValue).toEqual(['data-literacy', 'python-basics', 'Unknown']);
    // An unmatched stored value stays selectable rather than vanishing.
    expect(f.options?.map(o => o.value)).toContain('Unknown');
  });

  it('injects a code-valued skill field for a non-K12 framework when the form has none (existing per-category path)', () => {
    const fields = useFieldPrepare([{ code: 'framework', label: 'Course Type' }], { skill: ['Data literacy'] }, usf, true, {});
    const f = find(fields, 'skill')!;
    expect(f.isSkillField).toBe(true);
    expect(f.options?.map(o => o.value)).toEqual(['data-literacy', 'python-basics']);
    expect(f.currentValue).toEqual(['data-literacy']);
    // Other injected categories keep their name values.
    expect(find(fields, 'industry')!.options).toEqual([{ label: 'IT', value: 'IT' }]);
  });

  it('stays form-driven for a K-12-shaped framework — no skill field unless the form declares one', () => {
    expect(find(useFieldPrepare([{ code: 'name', label: 'Title' }], {}, k12WithSkill, true, {}), 'skill')).toBeUndefined();
  });

  it("never treats a K-12 framework's highest-index classic category (topic) as the skill field", () => {
    const cfg = [{ code: 'topic', label: 'Topics', sourceCategory: 'topic', inputType: 'multiselect' }];
    const f = find(useFieldPrepare(cfg, {}, ncf, true, {}), 'topic')!;
    expect(f.isSkillField).toBeUndefined();
    expect(f.options).toEqual([{ label: 'Fractions', value: 'Fractions' }]);
  });

  it('still drops the skill category from the Learning Path root form (Level SkillPicker owns skills)', () => {
    const fields = useFieldPrepare([skillField], { framework: 'USF' }, usf, true, { profile: learningPathProfile });
    expect(find(fields, 'skill')).toBeUndefined();
  });
});
