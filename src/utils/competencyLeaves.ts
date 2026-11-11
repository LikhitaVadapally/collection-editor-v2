/**
 * Leaf skills of a `CompetencyFramework` (Knowlg `/competency-framework/v3/read`), worked out the
 * way lern-service does it (`CompetencyFrameworkUtil.parseTree`), so a course is only ever tagged
 * with skills lern can credit. Mirrors the portal's `skillLeaves.frameworkLeaves`.
 *
 * The walk starts at the `competency` category and accepts all three authoring shapes:
 *   1. `children`     - tiers nested inside the `competency` category;
 *   2. `associations` - tiers in separate categories (competencyarea -> competency -> skill). Only
 *                       associations that LEAVE the term's own category are followed, each looked
 *                       up by identifier, because association entries are shallow;
 *   3. `parentCode`   - a flat list: a code nobody names as its parent is a leaf.
 * Interior terms are navigation only; they are never offered as skills.
 */

export interface CompetencyTermWire {
  identifier?: string;
  code?: string;
  name?: string;
  category?: string;
  status?: string;
  children?: CompetencyTermWire[];
  associations?: Array<{ identifier?: string; category?: string }>;
  parentCode?: string;
  parents?: Array<{ code?: string }>;
}

export interface CompetencyCategoryWire {
  code?: string;
  index?: number;
  terms?: CompetencyTermWire[];
}

export interface CompetencySkill {
  code: string;
  name: string;
}

const ROOT_CATEGORY = 'competency';

function descendantsOf(categories: CompetencyCategoryWire[]) {
  const index = new Map<string, CompetencyTermWire>();
  categories.forEach((c) => (c.terms ?? []).forEach((t) => t.identifier && index.set(t.identifier, t)));
  const resolve = (t: CompetencyTermWire) => (t.identifier && index.get(t.identifier)) || t;
  return (t: CompetencyTermWire, seen: Set<string>): CompetencyTermWire[] => {
    if (t.children?.length) return t.children.map(resolve);
    const own = t.category ?? '';
    return (t.associations ?? []).flatMap((a) => {
      if (!a.category || a.category === own || !a.identifier || seen.has(a.identifier)) return [];
      const target = index.get(a.identifier);
      return target ? [target] : [];
    });
  };
}

/** Leaf skill codes, sorted. Empty when the framework has no `competency` category. */
export function competencyLeafCodes(categories: CompetencyCategoryWire[] | undefined): string[] {
  const cats = categories ?? [];
  const roots = cats.find((c) => c.code === ROOT_CATEGORY)?.terms ?? [];
  if (roots.length === 0) return [];
  const descendants = descendantsOf(cats);

  const leaves = new Set<string>();
  let maxTier = 0;
  const walk = (t: CompetencyTermWire, tier: number, seen: Set<string>) => {
    if (t.identifier && seen.has(t.identifier)) return;
    const nextSeen = t.identifier ? new Set(seen).add(t.identifier) : seen;
    const next = descendants(t, nextSeen);
    if (next.length === 0) {
      if (t.code) leaves.add(t.code);
      maxTier = Math.max(maxTier, tier);
    } else next.forEach((n) => walk(n, tier + 1, nextSeen));
  };
  roots.forEach((r) => walk(r, 1, new Set()));
  if (maxTier > 1) return [...leaves].sort();

  // Flat shape: anything that is nobody's parent is a leaf.
  const parentOf = new Map<string, string>();
  roots.forEach((t) => {
    const parent = t.parentCode ?? t.parents?.find((p) => p.code)?.code;
    if (t.code && parent) parentOf.set(t.code, parent);
  });
  if (parentOf.size === 0) return [...leaves].sort();
  const parents = new Set(parentOf.values());
  return roots
    .map((t) => t.code)
    .filter((c): c is string => Boolean(c) && !parents.has(c as string))
    .sort();
}

/** Leaf skills with their authored names, sorted by name. */
export function competencyLeafSkills(categories: CompetencyCategoryWire[] | undefined): CompetencySkill[] {
  const names = new Map<string, string>();
  const record = (t: CompetencyTermWire) => {
    if (t.code && t.name && !names.has(t.code)) names.set(t.code, t.name);
    (t.children ?? []).forEach(record);
  };
  (categories ?? []).forEach((c) => (c.terms ?? []).forEach(record));
  return competencyLeafCodes(categories)
    .map((code) => ({ code, name: names.get(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
