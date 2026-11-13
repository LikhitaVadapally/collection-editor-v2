export interface ITerm {
  identifier: string;
  name: string;
  code: string;
  index?: number;
  /** Framework category this term belongs to (e.g. 'board', 'medium').
   *  Association entries carry this so a parent term's associations can be
   *  filtered down to a single child category — mirrors Angular's
   *  `a.category === field.sourceCategory` filter. */
  category?: string;
  status?: string;
  description?: string;
  associations?: ITerm[];
}

export interface ICategory {
  identifier: string;
  name: string;
  code: string;
  /** Category order within the framework — the LP editor resolves the
   *  skill-equivalent category as the one with the highest index (USF's
   *  `skill` category also has the highest index, so one rule covers both). */
  index?: number;
  terms?: ITerm[];
}

export interface IFramework {
  identifier: string;
  name: string;
  code: string;
  categories?: ICategory[];
}

export interface IFrameworkDetails {
  organisationFramework?: IFramework;
  targetFrameworks?: IFramework[];
  /** Options for the 'framework' (Course Type) field — built from channel.frameworks
   *  filtered/extended by orgFWType from the category definition. */
  orgFrameworks?: Array<{ label: string; value: string }>;
  /** Options for the 'additionalCategories' field — from channel.collectionAdditionalCategories. */
  channelAdditionalCategories?: string[];
  /** Course skill tagging against a `CompetencyFramework` (lern reads `competencyFramework` +
   *  `skill`). Absent when the node isn't a Course root. */
  competency?: ICompetencyTagging;
}

export interface ICompetencyTagging {
  /** The channel's Live competency frameworks. */
  frameworks: Array<{ label: string; value: string }>;
  /** Whether `frameworks` has loaded — until then a stored id can't be checked. */
  frameworksLoaded: boolean;
  /** Leaf skills of the selected competency framework. */
  skills: Array<{ code: string; name: string }>;
  /**
   * The content field those skills are stored in: the framework's last category code (`skill`,
   * `cuisine`, ...), which is the field lern reads. Unset until the framework loads.
   */
  skillField?: string;
  /** Learning Path only: live roles of the selected competency framework. */
  roles?: Array<{ label: string; value: string }>;
}
