import { describe, it, expect } from 'vitest';
import { isPlainCourseRoot, resolveCourseCompetency } from './useCourseCompetency';

const terms = [
  { identifier: 'cuisine-french', code: 'cuisine-french', name: 'French Cuisine' },
  { identifier: 'cuisine-italian', code: 'cuisine-italian', name: 'Italian Cuisine' },
];
const loaded = { usableFrameworkId: 'culinary_test', skillField: 'cuisine', terms };

describe('isPlainCourseRoot', () => {
  it('is a Course by the root primaryCategory, else the editor config', () => {
    expect(isPlainCourseRoot('collection', { primaryCategory: 'Course' }, undefined)).toBe(true);
    expect(isPlainCourseRoot('collection', {}, 'Course')).toBe(true);
  });

  it('is not a Course for a Learning Path, an Evaluation Course or another collection', () => {
    expect(isPlainCourseRoot('learningPath', { primaryCategory: 'Course' }, 'Course')).toBe(false);
    expect(isPlainCourseRoot('collection', { primaryCategory: 'Evaluation Course' }, undefined)).toBe(false);
    expect(isPlainCourseRoot('collection', { primaryCategory: 'Digital Textbook' }, undefined)).toBe(false);
  });
});

describe('resolveCourseCompetency', () => {
  it("is ready with the course's framework, skill field and skills", () => {
    expect(resolveCourseCompetency(true, { cuisine: ['cuisine-french'] }, loaded)).toEqual({
      isCourse: true, frameworkId: 'culinary_test', skillField: 'cuisine', skills: ['cuisine-french'], terms, ready: true,
    });
  });

  it('is not ready while the course has no skills chosen', () => {
    const r = resolveCourseCompetency(true, { cuisine: [] }, loaded);
    expect(r.ready).toBe(false);
    expect(r.frameworkId).toBe('culinary_test');
  });

  it('is inert until the framework loads, or when it has no skills (a stored NCF)', () => {
    expect(resolveCourseCompetency(true, { cuisine: ['cuisine-french'] }, { ...loaded, usableFrameworkId: undefined }).ready).toBe(false);
    expect(resolveCourseCompetency(true, { skill: ['x'] }, { usableFrameworkId: undefined, skillField: undefined, terms: [] }))
      .toMatchObject({ isCourse: true, frameworkId: undefined, ready: false });
  });

  it('reads a course tagged by skill name as codes', () => {
    expect(resolveCourseCompetency(true, { cuisine: ['French Cuisine'] }, loaded).skills).toEqual(['cuisine-french']);
  });

  it('is inert for anything but a Course', () => {
    expect(resolveCourseCompetency(false, { cuisine: ['cuisine-french'] }, loaded)).toMatchObject({ isCourse: false, frameworkId: undefined, ready: false });
  });
});
