import { describe, it, expect } from 'vitest';
import { cardCaption, courseSkillTags, skillTags } from './libraryCardMeta';
import type { ITerm } from '../types/framework';

const terms = [
  { identifier: 't1', code: 'crop-rotation-planning', name: 'Crop Rotation Planning' },
  { identifier: 't2', code: 'crop-survey', name: 'Crop Survey' },
  { identifier: 't3', code: 'farmer-counselling', name: 'Farmer Counselling' },
] as unknown as ITerm[];
const course = { frameworkId: 'agro', skillField: 'skill', skills: ['crop-rotation-planning'], terms };

describe('cardCaption', () => {
  it('joins the org name and category with a separator (positive)', () => {
    expect(cardCaption({ organisation: ['Sunbird Org'], primaryCategory: 'Practice Question Set' })).toBe('Sunbird Org · Practice Question Set');
  });

  it('shows just the category without an org name, never the channel id (negative)', () => {
    const item = { primaryCategory: 'Practice Question Set', channel: '0146092176054435840' };
    expect(cardCaption(item)).toBe('Practice Question Set');
    expect(cardCaption({ organisation: [''], primaryCategory: 'eTextbook' })).toBe('eTextbook');
  });
});

describe('courseSkillTags', () => {
  it("names an item's skills, the course's own first and marked (positive)", () => {
    const item = { competencyFramework: 'agro', skill: ['crop-survey', 'crop-rotation-planning'] };
    expect(courseSkillTags(item, course)).toEqual([
      { label: 'Crop Rotation Planning', matched: true },
      { label: 'Crop Survey', matched: false },
    ]);
  });

  it('treats a legacy name tag like its code and lists it once (positive)', () => {
    const item = { competencyFramework: 'agro', skill: ['Crop Rotation Planning', 'crop-rotation-planning'] };
    expect(courseSkillTags(item, course)).toEqual([{ label: 'Crop Rotation Planning', matched: true }]);
  });

  it("shows nothing for another framework's item, or before the course has a framework (negative)", () => {
    expect(courseSkillTags({ competencyFramework: 'culinary_test', skill: ['crop-survey'] }, course)).toEqual([]);
    expect(courseSkillTags({ competencyFramework: 'agro', skill: ['crop-survey'] }, { ...course, frameworkId: undefined })).toEqual([]);
    expect(courseSkillTags({ competencyFramework: 'agro' }, course)).toEqual([]);
  });
});

describe('skillTags', () => {
  const terms = [
    { identifier: 'crop-survey', code: 'crop-survey', name: 'Crop Survey' },
    { identifier: 'soil-sampling', code: 'soil-sampling', name: 'Soil Sampling' },
  ];

  it('lists the wanted skills first and marks them, matching a legacy name to its code', () => {
    expect(skillTags(['soil-sampling', 'Crop Survey'], ['crop-survey'], terms)).toEqual([
      { label: 'Crop Survey', matched: true },
      { label: 'Soil Sampling', matched: false },
    ]);
  });

  it('shows one chip per skill whether tagged by code or name', () => {
    expect(skillTags(['crop-survey', 'Crop Survey'], [], terms)).toEqual([{ label: 'Crop Survey', matched: false }]);
  });
});
