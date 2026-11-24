import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import styles from './Field.module.scss';

/** A short list is quicker to scan than to search, so the box shows only above this many options. */
export const SEARCH_MIN_OPTIONS = 7;

export function filterOptions<T extends { label: string }>(options: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
}

/** Filters dropdown options by label as the user types. Clear `query` when the dropdown closes. */
export function useOptionSearch<T extends { label: string }>(options: T[]) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  return { query, setQuery, filtered, searchable: options.length >= SEARCH_MIN_OPTIONS };
}

export const OptionSearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({
  value, onChange, placeholder,
}) => (
  <div className={styles.optionSearch}>
    <Search size={13} aria-hidden />
    <input
      type="text"
      autoFocus
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);
