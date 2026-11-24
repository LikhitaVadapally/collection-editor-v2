import { describe, it, expect } from 'vitest';
import { filterOptions } from './OptionSearch';

const skills = [
  { label: 'Use Promises', value: 'fe_sk_promises' },
  { label: 'Use Async Await', value: 'fe_sk_await' },
  { label: 'Call a REST API', value: 'fe_sk_fetch' },
];

describe('filterOptions', () => {
  it('returns every option for an empty or blank query', () => {
    expect(filterOptions(skills, '')).toEqual(skills);
    expect(filterOptions(skills, '   ')).toEqual(skills);
  });

  it('matches anywhere in the label, ignoring case and surrounding spaces', () => {
    expect(filterOptions(skills, ' ASYNC ').map(o => o.value)).toEqual(['fe_sk_await']);
    expect(filterOptions(skills, 'use').map(o => o.value)).toEqual(['fe_sk_promises', 'fe_sk_await']);
  });

  it('matches the label, not the code', () => {
    expect(filterOptions(skills, 'fe_sk')).toEqual([]);
  });
});
