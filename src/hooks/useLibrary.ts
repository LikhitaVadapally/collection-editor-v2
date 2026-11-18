import { useCallback, useEffect, useRef, useState } from 'react';
import { useLibraryStore } from '../store/library.store';
import { useEditorStore } from '../store/editor.store';
import { useTreeStore } from '../store/tree.store';
import { useUiStore } from '../store/ui.store';
import { useSkillCategory } from './useSkillCategory';
import { useLpCompetency } from './useLpCompetency';
import { useCourseCompetency } from './useCourseCompetency';
import { useSkillScope, type ISkillScope } from './useSkillScope';
import { COMPETENCY_FRAMEWORK_FIELD } from '../utils/lpCompetency';
import { EVALUATION_COURSE_CATEGORY, getExplicitCurriculum } from '../utils/lpStructure';
import { compositeSearch, DEFAULT_SEARCH_FIELDS } from '../api/content';
import { skillFilterValues } from '../utils/skillTerms';
import { LIBRARY_PRIMARY_CATEGORIES, type IContent } from '../types/content';
import type { LibraryFilters } from '../components/LibraryDock/LibraryFilterPanel';
import type { ITerm } from '../types/framework';

/**
 * Course profile, "Teaches this course's skills" section: content in the course's own skill framework that
 * carries at least one of the course's skills. Skill codes only mean something inside their own
 * framework, hence the framework filter. A plain array is Knowlg's "any of" (unlike the LP
 * Level's `subsetOf`): a PDF that also covers another skill still teaches this one. Names ride
 * along with codes so content tagged with legacy names matches too.
 */
export function buildCourseLibraryFilters(
  frameworkId: string,
  skillField: string,
  skills: string[],
  terms: ITerm[] | undefined,
): Record<string, unknown> {
  return {
    [COMPETENCY_FRAMEWORK_FIELD]: [frameworkId],
    [skillField]: skillFilterValues(skills, terms),
  };
}

/**
 * Course profile, "Other content" section: the same browse with content tagged with any of the
 * course's skills left out. Knowlg's `{ "!=": [...] }` means "none of" and keeps content with no
 * tag at all, so the exclusion happens in the search: the section pages like the main list and
 * its count is the real total. Skill codes are framework-specific, so the skill field alone is
 * enough to tell a match apart.
 */
export function buildOtherContentFilters(
  browseFilters: Record<string, unknown>,
  skillField: string,
  matchValues: string[],
): Record<string, unknown> {
  return { ...browseFilters, [skillField]: { '!=': matchValues } };
}

/**
 * Course profile: the hint above the Library. A Course with no skill framework or no skills yet
 * gets a nudge to pick them, since that's what sorts the matching content first.
 */
export function courseLibraryHint(course: { isCourse: boolean; ready: boolean }): 'pickSkills' | null {
  return course.isCourse && !course.ready ? 'pickSkills' : null;
}

/**
 * LP profile library filters: search is strictly constrained to Courses, or
 * to Evaluation Course specifically while picking the Prior/Outcome slot or
 * a Level Exam course (isPickingEvaluationCourse) — a course can only ever
 * fill those roles by being authored under that category (see
 * isEvaluationCourse). Without a target role, filling the pre/post assessment
 * slot has no skill constraint (the prior assessment *defines* the skill
 * scope, so it can't be filtered by it); with one, it must test the role's
 * skills. Any other pick, a Level Exam course included, is narrowed to the
 * path's skill scope (`browseSkillValues`) once there is one.
 *
 * `browseSkillValues` and `competency.roleSkillValues` are search values:
 * term codes plus their names, so courses tagged with legacy names match.
 */
export function buildLpLibraryFilters(
  activeAssessmentSlot: 'pre' | 'post' | null,
  isPickingEvaluationCourse: boolean,
  browseSkillValues: string[],
  skillCategoryCode: string | undefined,
  frameworkId?: string,
  competency?: { frameworkId: string; roleSkillValues: string[] },
): Record<string, unknown> {
  const filters: Record<string, unknown> = {
    primaryCategory: [isPickingEvaluationCourse ? EVALUATION_COURSE_CATEGORY : 'Course'],
  };
  if (competency) {
    // Skill codes only mean something inside their own competency framework.
    filters[COMPETENCY_FRAMEWORK_FIELD] = [competency.frameworkId];
    // The Prior/Outcome Assessment must test the target role's skills.
    if (activeAssessmentSlot && competency.roleSkillValues.length && skillCategoryCode) {
      filters[skillCategoryCode] = competency.roleSkillValues;
      return filters;
    }
  } else if (frameworkId) {
    // Courses must belong to the LP root's selected curriculum (framework) —
    // a course tagged under another framework carries skills the path's scope
    // can't read.
    filters['framework'] = [frameworkId];
  }
  if (!activeAssessmentSlot && browseSkillValues.length && skillCategoryCode) {
    // Only courses whose skills ALL lie within the scope (Knowlg's subsetOf): a course that also
    // teaches a skill outside it would carry that skill into the path unasked.
    filters[skillCategoryCode] = { subsetOf: browseSkillValues };
  }
  return filters;
}

/**
 * LP profile search fields: append the resolved skill-category code so each
 * returned course carries its own skill tags in `metadata` — Skills
 * covered, useSkillScope, and the publish-time "course has no skill tag"
 * check all read that field off the linked course node, and it's otherwise
 * absent from the default search field set (Collection profile leaves the
 * default fields untouched).
 */
export function buildSearchFields(
  competencyScoped: boolean,
  skillCategoryCode: string | undefined,
  courseSkillField?: string,
): string[] | undefined {
  // A Course with a skill framework: each item's framework and skill tags ride along so its card
  // can show the skills it teaches.
  if (!competencyScoped && courseSkillField) return [...DEFAULT_SEARCH_FIELDS, courseSkillField, COMPETENCY_FRAMEWORK_FIELD];
  if (!competencyScoped || !skillCategoryCode) return undefined;
  // 'framework' rides along so a linked course knows which taxonomy its
  // skill tags live under (useSkillCategory resolves via the prior course's
  // framework, which may differ from the LP's own).
  return [...DEFAULT_SEARCH_FIELDS, skillCategoryCode, 'framework', COMPETENCY_FRAMEWORK_FIELD];
}

/**
 * Why the Library is (or would be) empty for the LP profile, so the dock can
 * show a guiding message instead of the generic "no results" empty state —
 * mandatory per learning_path_plan.md §3 item 3: with neither a Curriculum nor
 * a skill framework chosen there's no framework to scope search by, so
 * browsing must show nothing rather than every course. Doesn't apply to
 * Collection, or while picking an Evaluation Course for the Prior/Outcome
 * Assessment slot or a Level Exam — that course *defines* the skill scope
 * (and isn't required to belong to any particular Curriculum), so the gate
 * doesn't apply while filling it. isPickingEvaluationCourse mirrors
 * useLibrary's own activeAssessmentSlot-or-activeLevelExamTarget check.
 */
export function computeLibraryEmptyReason(
  competencyScoped: boolean,
  frameworkId: string | undefined,
  isPickingEvaluationCourse = false,
): 'noCurriculum' | null {
  if (!competencyScoped) return null;
  if (isPickingEvaluationCourse) return null;
  if (!frameworkId) return 'noCurriculum';
  return null;
}

/**
 * Skills the LP Library browses for: the path's skill scope (useSkillScope) — the target role's
 * skills, else the Prior Assessment's. A Level's skills are worked out from its courses, so they
 * never narrow the Library. With no role and no Prior Assessment nothing narrows it (`manual`).
 */
export function resolveBrowseSkills(scope: ISkillScope): string[] {
  return scope.source === 'manual' ? [] : scope.scope;
}

/**
 * LP profile: the competency scope of the search, with the role's skills as search values (codes
 * and names) so courses tagged with legacy names match. None without a usable skill framework.
 */
export function lpCompetencyScope(
  frameworkId: string | undefined,
  roleSkills: string[],
  terms: ITerm[] | undefined,
): { frameworkId: string; roleSkillValues: string[] } | undefined {
  return frameworkId ? { frameworkId, roleSkillValues: skillFilterValues(roleSkills, terms) } : undefined;
}

/**
 * Adds a page of "Other content" to what is shown. The next page starts after what the server
 * returned, not after what is shown, so an item dropped as already shown doesn't shift it.
 */
export function appendOtherPage(
  shown: IContent[],
  page: IContent[],
  offset: number,
): { content: IContent[]; nextOffset: number } {
  const content = offset === 0 ? page : [...shown, ...page.filter((c) => !shown.some((p) => p.identifier === c.identifier))];
  return { content, nextOffset: offset + page.length };
}

/** Hands out a token per request; only the newest one may apply its response. */
export function latestRequestGuard(): { next: () => number; isLatest: (token: number) => boolean; invalidate: () => void } {
  let current = 0;
  return {
    next: () => ++current,
    isLatest: (token) => token === current,
    invalidate: () => { current += 1; },
  };
}

const PAGE_SIZE = 20;
const NO_ITEMS: IContent[] = [];

/** The browse "Other content" pages through: set by each new main-list browse, reused by its Load more. */
interface IOtherBrowse {
  filters: Record<string, unknown>;
  query: string;
  sortBy: Record<string, string>;
  fields: string[] | undefined;
}

/**
 * Returns allowed primaryCategory values for the currently selected unit,
 * driven by editorConfig.config.hierarchy.levelN.children.Content.
 * Falls back to the full LIBRARY_PRIMARY_CATEGORIES constant.
 *
 * An Evaluation Course profile overrides this entirely, at every depth
 * (root or any Course Unit) — its content must be Question Sets or ECML
 * assessment content only, never regular course material.
 */
export function useAllowedCategories(): string[] {
  const config = useEditorStore((s) => s.editorConfig);
  const editorProfile = useEditorStore((s) => s.editorProfile);
  const selectedNodeId = useTreeStore((s) => s.selectedNodeId);
  const treeData = useTreeStore((s) => s.treeData);

  if (editorProfile.restrictedContentCategories) {
    return editorProfile.restrictedContentCategories;
  }

  // Compute selected node depth (root = 0)
  const depth = useCallback(() => {
    if (!selectedNodeId || !treeData.length) return 0;
    function getDepth(nodes: typeof treeData, id: string, d = 0): number {
      for (const n of nodes) {
        if (n.id === id) return d;
        if (n.children?.length) {
          const found = getDepth(n.children, id, d + 1);
          if (found >= 0) return found;
        }
      }
      return -1;
    }
    return Math.max(0, getDepth(treeData, selectedNodeId));
  }, [selectedNodeId, treeData])();

  const hierarchy = config?.config?.hierarchy as Record<string, unknown> | undefined;
  if (!hierarchy) return [...LIBRARY_PRIMARY_CATEGORIES];

  // level1 = depth 1, level2 = depth 2, etc.
  const levelKey = `level${depth}`;
  const levelConfig = hierarchy[levelKey] as Record<string, unknown> | undefined;
  const children = levelConfig?.children as Record<string, unknown> | undefined;
  const contentCategories = children?.['Content'] as string[] | undefined;

  if (contentCategories?.length) return contentCategories;
  return [...LIBRARY_PRIMARY_CATEGORIES];
}

export function useLibrary() {
  const store = useLibraryStore();
  const channel = useEditorStore((s) => s.editorConfig?.context?.channel ?? '');
  const allowedCategories = useAllowedCategories();
  const editorProfile = useEditorStore((s) => s.editorProfile);
  const activeAssessmentSlot = useUiStore((s) => s.activeAssessmentSlot);
  const activeLevelExamTarget = useUiStore((s) => s.activeLevelExamTarget);
  const treeData = useTreeStore((s) => s.treeData);
  const treeCache = useTreeStore((s) => s.treeCache);
  const skillCategory = useSkillCategory();
  // The LP root's EXPLICITLY chosen Curriculum only — never the channel/
  // context default (contentFramework) that useEditorInit/SparkMetaForm
  // resolve just so *something* exists to browse before the author has
  // chosen anything. Until this is set, the Library shows nothing rather
  // than silently scoping to a framework the author never picked.
  const lpFrameworkId = editorProfile.competencyScoped
    ? getExplicitCurriculum(treeData[0], treeCache)
    : undefined;
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lp = useLpCompetency();
  const competency = editorProfile.competencyScoped
    ? lpCompetencyScope(lp.frameworkId, lp.roleSkills, lp.terms)
    : undefined;
  const course = useCourseCompetency();
  // Course with skills: the main list is narrowed to them, and the rest sits in "Other content".
  const courseSkillFiltered = course.ready;
  const [otherContent, setOtherContent] = useState<IContent[]>(NO_ITEMS);
  // Read by fetchOtherPage, which runs after an await and would otherwise see a stale list.
  const otherContentRef = useRef(otherContent);
  otherContentRef.current = otherContent;
  const [otherTotal, setOtherTotal] = useState(0);
  // How far the server has paged, counted from what it returned: dropping an item already shown
  // must not shift the next page's offset.
  const [otherOffset, setOtherOffset] = useState(0);
  const [otherLoading, setOtherLoading] = useState(false);
  const otherBrowse = useRef<IOtherBrowse | null>(null);
  // A slow page of an older browse must not land in the current list.
  const otherGuard = useRef(latestRequestGuard()).current;
  // The same for the main list: an earlier, slower search (e.g. the unfiltered one fired before
  // the course's skills resolved) must not replace a newer one's results.
  const mainGuard = useRef(latestRequestGuard()).current;

  const clearOther = () => {
    otherGuard.invalidate();
    otherBrowse.current = null;
    setOtherContent(NO_ITEMS);
    setOtherTotal(0);
    setOtherOffset(0);
    setOtherLoading(false);
  };

  // One page of "Other content": the first replaces the list, later ones (Load more) append.
  const fetchOtherPage = async (browse: IOtherBrowse, offset: number) => {
    const token = otherGuard.next();
    setOtherLoading(true);
    try {
      const { content, count } = await compositeSearch({
        filters: browse.filters,
        query: browse.query,
        limit: PAGE_SIZE,
        offset,
        channel: channel || undefined,
        sortBy: browse.sortBy,
        fields: browse.fields,
      });
      if (!otherGuard.isLatest(token)) return;
      const page = appendOtherPage(otherContentRef.current, content, offset);
      setOtherContent(page.content);
      setOtherOffset(page.nextOffset);
      setOtherTotal(count);
    } catch (e) {
      console.error('[useLibrary] other content load error:', e);
    } finally {
      if (otherGuard.isLatest(token)) setOtherLoading(false);
    }
  };

  const isPickingEvaluationCourse = !!activeAssessmentSlot || !!activeLevelExamTarget;

  const skillScope = useSkillScope();
  const browseSkills = resolveBrowseSkills(skillScope);
  const emptyReason = computeLibraryEmptyReason(
    editorProfile.competencyScoped, competency?.frameworkId ?? lpFrameworkId, isPickingEvaluationCourse,
  );

  const load = useCallback(
    async (
      query = '',
      filter = 'all',
      advancedFilters: LibraryFilters = {},
      reset = true,
      sortAZ = false,
    ) => {
      const token = mainGuard.next();
      store.setLoading(true);
      try {
        // Neither a Curriculum nor a skill framework chosen: nothing to scope the search by, so
        // show nothing rather than every course (see computeLibraryEmptyReason).
        if (emptyReason) {
          store.setContent([], 0);
          clearOther();
          return;
        }
        let filters: Record<string, unknown>;
        if (editorProfile.competencyScoped) {
          // The scope is held as codes, but courses may still be tagged with legacy names — match
          // either.
          const lpFilters = buildLpLibraryFilters(
            activeAssessmentSlot, isPickingEvaluationCourse,
            skillFilterValues(browseSkills, skillCategory?.terms), skillCategory?.code, lpFrameworkId,
            competency,
          );
          filters = { status: ['Live'], ...lpFilters };
        } else {
          filters = {
            status: ['Live'],
            primaryCategory: filter && filter !== 'all'
              ? [filter]
              : allowedCategories,
          };
          if (advancedFilters?.board?.length) filters['board'] = advancedFilters.board;
          if (advancedFilters?.medium?.length) filters['medium'] = advancedFilters.medium;
          if (advancedFilters?.gradeLevel?.length) filters['gradeLevel'] = advancedFilters.gradeLevel;
          if (advancedFilters?.subject?.length) filters['subject'] = advancedFilters.subject;
          if (advancedFilters?.primaryCategory?.length) filters['primaryCategory'] = advancedFilters.primaryCategory;
        }
        // The browse without the course's skill filter, for the "Other content" search below.
        const unskilledFilters = { ...filters };
        const skillMatch = courseSkillFiltered && course.frameworkId && course.skillField
          ? buildCourseLibraryFilters(course.frameworkId, course.skillField, course.skills, course.terms)
          : undefined;
        if (skillMatch) Object.assign(filters, skillMatch);
        const sortBy: Record<string, string> = sortAZ ? { name: 'asc' } : { lastUpdatedOn: 'desc' };

        const currentOffset = reset ? 0 : store.offset;

        const { content, count } = await compositeSearch({
          filters,
          query,
          limit: query ? 50 : PAGE_SIZE,
          offset: currentOffset,
          channel: channel || undefined,
          sortBy,
          fields: buildSearchFields(editorProfile.competencyScoped, skillCategory?.code, course.skillField),
        });
        if (!mainGuard.isLatest(token)) return;

        if (reset) {
          store.setContent(content, count);
        } else {
          store.appendContent(content, count);
        }

        // A new browse restarts "Other content" from its first page; the main list's Load more
        // leaves it alone (it pages itself through loadMoreOther).
        if (reset) {
          if (!skillMatch || !course.skillField) {
            clearOther();
          } else {
            const browse: IOtherBrowse = {
              filters: buildOtherContentFilters(unskilledFilters, course.skillField, skillMatch[course.skillField] as string[]),
              query,
              sortBy,
              fields: buildSearchFields(editorProfile.competencyScoped, skillCategory?.code, course.skillField),
            };
            otherBrowse.current = browse;
            await fetchOtherPage(browse, 0);
          }
        }

      } catch (e) {
        console.error('[useLibrary] load error:', e);
      } finally {
        if (mainGuard.isLatest(token)) store.setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedCategories, channel, editorProfile, activeAssessmentSlot, isPickingEvaluationCourse, browseSkills, skillCategory, lpFrameworkId, emptyReason, competency?.frameworkId, competency?.roleSkillValues, courseSkillFiltered, course],
  );

  // Reset any in-progress search when the resolved framework (Curriculum)
  // changes — the previous query text doesn't apply to the new framework's
  // course set, and library.store's filteredContent would otherwise keep
  // filtering the freshly-fetched, framework-matching results by stale text.
  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    store.setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lpFrameworkId]);

  // Initial/channel-driven load — applies to every profile.
  // editorProfile.key is included because it resolves asynchronously
  // (useEditorInit calls setEditorProfile after this hook's own mount
  // effect may already have fired with the store's default collectionProfile)
  // — without it, an Evaluation Course's restrictedContentCategories would
  // never take effect: the very first load() call captures the default
  // (unrestricted) allowedCategories, and nothing else re-triggers this
  // effect since channel itself doesn't change once the profile resolves.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, editorProfile.key]);

  // LP-only: re-run on anything that changes what the search should be
  // scoped to (assessment slot or Level Exam target armed, the path's skill
  // scope, the root's Curriculum, its skill framework or target role). The
  // selected tree node doesn't scope the search, so clicking around the path
  // doesn't reload it. Gated by competencyScoped so Collection's user-driven
  // search/filter/sort state (set via the search/setFilter/etc. callbacks
  // below) is never silently reset.
  useEffect(() => {
    if (!editorProfile.competencyScoped) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorProfile.competencyScoped, activeAssessmentSlot, activeLevelExamTarget, browseSkills.join('|'), lpFrameworkId, competency?.frameworkId, competency?.roleSkillValues.join('|')]);

  // Course-only: re-run when the course's skill framework or skills change. The author's
  // search/filter/sort state is kept, since the change re-sorts the same browse rather than
  // starting a new one.
  const courseSkillsKey = course.skills.join('|');
  const courseEffectMounted = useRef(false);
  useEffect(() => {
    // The channel/profile effect above already ran the first load.
    if (!courseEffectMounted.current) {
      courseEffectMounted.current = true;
      return;
    }
    if (editorProfile.competencyScoped) return;
    load(store.searchQuery, store.activeFilter, store.advancedFilters, true, store.sortAZ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.ready, course.frameworkId, course.skillField, courseSkillsKey]);

  const search = useCallback(
    (query: string) => {
      store.setSearch(query);
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(
        () => load(query, store.activeFilter, store.advancedFilters, true, store.sortAZ),
        300,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.activeFilter, store.advancedFilters, store.sortAZ, load],
  );

  const setFilter = useCallback(
    (filter: string) => {
      store.setFilter(filter);
      load(store.searchQuery, filter, store.advancedFilters, true, store.sortAZ);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.searchQuery, store.advancedFilters, store.sortAZ, load],
  );

  const applyAdvancedFilters = useCallback(
    (advancedFilters: LibraryFilters) => {
      store.setAdvancedFilters(advancedFilters);
      load(store.searchQuery, store.activeFilter, advancedFilters, true, store.sortAZ);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.searchQuery, store.activeFilter, store.sortAZ, load],
  );

  const toggleSort = useCallback(() => {
    const nextSortAZ = !store.sortAZ;
    store.setSortAZ(nextSortAZ);
    load(store.searchQuery, store.activeFilter, store.advancedFilters, true, nextSortAZ);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sortAZ, store.searchQuery, store.activeFilter, store.advancedFilters, load]);

  const loadMore = useCallback(() => {
    if (store.isLoading) return;
    load(store.searchQuery, store.activeFilter, store.advancedFilters, false, store.sortAZ);
  }, [store.isLoading, store.searchQuery, store.activeFilter, store.advancedFilters, store.sortAZ, load]);

  const hasMore = store.allContent.length < store.totalCount;

  const loadMoreOther = useCallback(() => {
    const browse = otherBrowse.current;
    if (!browse || otherLoading) return;
    void fetchOtherPage(browse, otherOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherLoading, otherOffset, channel]);

  return {
    content: store.filteredContent,
    isLoading: store.isLoading,
    totalCount: store.totalCount,
    activeFilter: store.activeFilter,
    advancedFilters: store.advancedFilters,
    searchQuery: store.searchQuery,
    sortAZ: store.sortAZ,
    hasMore,
    search,
    setFilter,
    applyAdvancedFilters,
    toggleSort,
    loadMore,
    refetch: () => load(store.searchQuery, store.activeFilter, store.advancedFilters, true, store.sortAZ),
    // LP profile only — drives the dock's "filling the Prior/Outcome
    // Assessment slot" banner.
    activeAssessmentSlot,
    // LP profile only — why content is (or would be) empty, so the dock can
    // show a guiding message instead of the generic "no results" state.
    emptyReason,
    // Course profile only — with skills, the main list holds the content that teaches them and
    // otherContent the rest; without, a hint to pick them.
    skillMatched: courseSkillFiltered,
    otherContent,
    otherTotal,
    otherLoading,
    otherHasMore: otherOffset < otherTotal,
    loadMoreOther,
    courseHint: courseLibraryHint(course),
  };
}
