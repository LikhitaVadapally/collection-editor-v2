import { describe, it, expect } from 'vitest';
import { competencyLeafCodes, competencyLeafSkills } from './competencyLeaves';

describe('competencyLeafCodes', () => {
  it('walks nested children inside the competency category and returns only leaves', () => {
    const categories = [{
      code: 'competency',
      terms: [{
        identifier: 'c1', code: 'patient-care', name: 'Patient care',
        children: [
          { identifier: 'c1a', code: 'hand-hygiene', name: 'Hand hygiene' },
          { identifier: 'c1b', code: 'ppe-use', name: 'PPE use' },
        ],
      }],
    }];
    expect(competencyLeafCodes(categories)).toEqual(['hand-hygiene', 'ppe-use']);
  });

  it('follows associations across competencyarea -> competency -> skill, but not within a category', () => {
    const categories = [
      { code: 'competencyarea', terms: [{ identifier: 'a1', code: 'clinical', category: 'competencyarea', associations: [{ identifier: 'c1', category: 'competency' }] }] },
      {
        code: 'competency',
        terms: [{
          identifier: 'c1', code: 'infection-control', category: 'competency',
          associations: [
            { identifier: 's1', category: 'skill' },
            { identifier: 'c2', category: 'competency' },
          ],
        }, { identifier: 'c2', code: 'other-competency', category: 'competency' }],
      },
      { code: 'skill', terms: [{ identifier: 's1', code: 'sterile-field', name: 'Sterile field', category: 'skill' }] },
    ];
    expect(competencyLeafCodes(categories)).toEqual(['other-competency', 'sterile-field']);
  });

  it('treats a flat parentCode list as a tree', () => {
    const categories = [{
      code: 'competency',
      terms: [
        { code: 'area' },
        { code: 'comp', parentCode: 'area' },
        { code: 'leaf-1', parentCode: 'comp' },
        { code: 'leaf-2', parentCode: 'comp' },
      ],
    }];
    expect(competencyLeafCodes(categories)).toEqual(['leaf-1', 'leaf-2']);
  });

  it('returns nothing without a competency category (a skill-only framework lern cannot read)', () => {
    expect(competencyLeafCodes([{ code: 'skill', terms: [{ code: 'x' }] }])).toEqual([]);
    expect(competencyLeafCodes(undefined)).toEqual([]);
  });
});

describe('competencyLeafSkills', () => {
  it('pairs each leaf with its authored name, sorted by name, falling back to the code', () => {
    const categories = [{
      code: 'competency',
      terms: [{
        identifier: 'c1', code: 'care',
        children: [
          { identifier: 'l1', code: 'ppe-use', name: 'PPE use' },
          { identifier: 'l2', code: 'hand-hygiene', name: 'Hand hygiene' },
          { identifier: 'l3', code: 'no-name' },
        ],
      }],
    }];
    expect(competencyLeafSkills(categories)).toEqual([
      { code: 'hand-hygiene', name: 'Hand hygiene' },
      { code: 'no-name', name: 'no-name' },
      { code: 'ppe-use', name: 'PPE use' },
    ]);
  });
});
