import { describe, it, expect, beforeEach } from 'vitest';
import { useTreeStore } from './tree.store';
import { useEditorStore } from './editor.store';
import type { INode } from '../types/editor';

const root = (): INode => ({
  id: 'root', identifier: 'root', name: 'Course', isFolder: true, children: [],
  metadata: { name: 'Course', competencyFramework: 'agro', skill: ['soil-sampling'] },
});

describe('tree.store updateNode — dirty flag', () => {
  beforeEach(() => {
    useEditorStore.setState({ editorMode: 'edit', isDirty: false });
    useTreeStore.setState({ treeData: [root()], treeCache: {}, selectedNodeId: 'root' });
  });

  it('a patch that only re-writes stored values does not mark the tree dirty', () => {
    useTreeStore.getState().updateNode('root', { competencyFramework: 'agro', skill: ['soil-sampling'] });
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it('a real change marks the tree dirty', () => {
    useTreeStore.getState().updateNode('root', { skill: ['soil-sampling', 'staff-briefing'] });
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('a silent patch (load-time normalization) never marks the tree dirty, but is still stored', () => {
    useTreeStore.getState().updateNode('root', { medium: ['English'] }, undefined, { silent: true });
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(useTreeStore.getState().treeCache.root?.medium).toEqual(['English']);
  });

  it('re-writing a value already edited in this session is not a new change', () => {
    useTreeStore.getState().updateNode('root', { name: 'Renamed' });
    useEditorStore.setState({ isDirty: false }); // as after a save
    useTreeStore.getState().updateNode('root', { name: 'Renamed' });
    expect(useEditorStore.getState().isDirty).toBe(false);
  });
});
