import { describe, it, expect, beforeEach } from 'vitest';
import { levelSkillPatches } from './useSkillsCoveredSync';
import { useTreeStore } from '../store/tree.store';
import { useEditorStore } from '../store/editor.store';
import type { INode } from '../types/editor';

const course = (id: string, skill: string[]): INode =>
  ({ id, identifier: id, name: id, isFolder: true, children: [], metadata: { skill } });
const level = (id: string, courses: INode[], stored?: string[]): INode =>
  ({ id, identifier: id, name: id, isFolder: true, children: courses, metadata: stored ? { skill: stored } : {} });

describe('levelSkillPatches', () => {
  it('patches a Level whose stored skills differ from its courses (positive)', () => {
    const lvl = level('L1', [course('c1', ['soil-sampling']), course('c2', ['crop-survey'])], ['crop-survey']);
    expect(levelSkillPatches([lvl], 'skill', {})).toEqual([{ id: 'L1', skills: ['soil-sampling', 'crop-survey'] }]);
  });

  it('leaves a Level that already matches, in any order (negative)', () => {
    const lvl = level('L1', [course('c1', ['soil-sampling']), course('c2', ['crop-survey'])], ['crop-survey', 'soil-sampling']);
    expect(levelSkillPatches([lvl], 'skill', {})).toEqual([]);
  });

  it('leaves assessment Levels alone (negative)', () => {
    const exam = { ...course('x', ['crop-survey']), metadata: { skill: ['crop-survey'], isAssessmentCourse: true } };
    expect(levelSkillPatches([level('pre', [exam])], 'skill', {})).toEqual([]);
  });
});

describe('opening a path: applying the Level sync', () => {
  beforeEach(() => {
    const lvl = level('L1', [course('c1', ['soil-sampling'])], []);
    const root: INode = { id: 'root', identifier: 'root', name: 'Path', isFolder: true, children: [lvl], metadata: {} };
    useEditorStore.setState({ editorMode: 'edit', isDirty: false });
    useTreeStore.setState({ treeData: [root], treeCache: {}, selectedNodeId: 'root' });
  });

  it('stores the derived skills without marking the path unsaved (positive)', () => {
    const { treeData, treeCache, updateNode } = useTreeStore.getState();
    levelSkillPatches(treeData[0]!.children!, 'skill', treeCache)
      .forEach(({ id, skills }) => updateNode(id, { skill: skills }, ['skill'], { silent: true }));
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useTreeStore.getState().treeCache.L1?.skill).toEqual(['soil-sampling']);
  });
});
