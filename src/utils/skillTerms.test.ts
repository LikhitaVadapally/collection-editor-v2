import { describe, it, expect } from 'vitest';
import { findSkillTerm, skillFilterValues, skillLabel, toSkillCode, toSkillCodes } from './skillTerms';

const terms = [
  { identifier: 't1', name: 'Data literacy', code: 'data-literacy' },
  { identifier: 't2', name: 'Java', code: 'java' },
  // A term whose CODE equals another term's NAME — code must win.
  { identifier: 't3', name: 'Scripting', code: 'Data literacy' },
];

describe('skillTerms', () => {
  it('matches by code first, then case-insensitive name', () => {
    expect(findSkillTerm('java', terms)?.identifier).toBe('t2');
    expect(findSkillTerm('JAVA', terms)?.identifier).toBe('t2');
    expect(findSkillTerm('Data literacy', terms)?.identifier).toBe('t3');
    expect(findSkillTerm('data LITERACY', terms)?.identifier).toBe('t1');
    expect(findSkillTerm('nope', terms)).toBeUndefined();
    expect(findSkillTerm('java', undefined)).toBeUndefined();
  });

  it('normalises to codes, keeping unknown values and de-duplicating', () => {
    expect(toSkillCode('Java', terms)).toBe('java');
    expect(toSkillCode('Unknown', terms)).toBe('Unknown');
    expect(toSkillCodes(['Java', 'java', 'Unknown'], terms)).toEqual(['java', 'Unknown']);
    expect(toSkillCodes('Java', terms)).toEqual(['java']);
    expect(toSkillCodes(undefined, terms)).toEqual([]);
    expect(toSkillCodes('', terms)).toEqual([]);
  });

  it('labels codes and legacy names with the term name', () => {
    expect(skillLabel('data-literacy', terms)).toBe('Data literacy');
    expect(skillLabel('java', terms)).toBe('Java');
    expect(skillLabel('Unknown', terms)).toBe('Unknown');
  });

  it('expands search filter values to both code and name', () => {
    expect(skillFilterValues(['java', 'Unknown'], terms)).toEqual(['java', 'Java', 'Unknown']);
  });
});
