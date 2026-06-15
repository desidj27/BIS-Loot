'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { gameInputClass, gameLabelClass, itemCardRarityClass } from '@/lib/gameTheme';
import { addSearchHistory, readSearchHistory } from '@/lib/searchHistory';
import {
  ItemSearchResult,
  searchItemsForLookup,
} from '@/lib/marketFilters';

interface ItemSearchBarProps {
  className?: string;
  label?: string;
  placeholder?: string;
}

export default function ItemSearchBar({
  className,
  label = 'Find item',
  placeholder = 'Search item name…',
}: ItemSearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ItemSearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<string[]>(() => readSearchHistory());
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const showDropdown = suggestOpen && (suggestLoading || suggestions.length > 0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);
    const timer = window.setTimeout(() => {
      searchItemsForLookup(trimmed)
        .then((results) => {
          setSuggestions(results);
          setActiveIndex(-1);
          setSuggestOpen(results.length > 0);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestLoading(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  function goToItem(result: ItemSearchResult) {
    addSearchHistory(result.name);
    setRecentItems(readSearchHistory());
    setQuery('');
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveIndex(-1);
    router.push(`/item/${encodeURIComponent(result.id)}`);
  }

  async function commitSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (suggestOpen && activeIndex >= 0 && suggestions[activeIndex]) {
      goToItem(suggestions[activeIndex]);
      return;
    }

    if (suggestions.length > 0) {
      goToItem(suggestions[0]);
      return;
    }

    setSuggestLoading(true);
    try {
      const results = await searchItemsForLookup(trimmed);
      if (results.length > 0) {
        goToItem(results[0]);
      }
    } finally {
      setSuggestLoading(false);
    }
  }

  async function goToRecent(name: string) {
    setQuery(name);
    setSuggestLoading(true);
    try {
      const results = await searchItemsForLookup(name);
      const match =
        results.find((result) => result.name.toLowerCase() === name.toLowerCase()) ?? results[0];
      if (match) goToItem(match);
    } finally {
      setSuggestLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      if (!showDropdown || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      if (!showDropdown || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }

    if (e.key === 'Escape') {
      setSuggestOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      commitSearch();
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className={gameLabelClass}>{label}</span>
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="item-search-suggestions"
          placeholder={placeholder}
          className={cn(gameInputClass, 'pr-8')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSuggestOpen(true);
          }}
          onFocus={() => {
            if (blurTimer.current) window.clearTimeout(blurTimer.current);
            if (suggestions.length > 0) setSuggestOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setSuggestOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#8a7f72] hover:text-[#ddd6cb]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setSuggestOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}

        {showDropdown && (
          <ul
            id="item-search-suggestions"
            className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto border border-[#4a4338] bg-[#171411] p-1 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            role="listbox"
          >
            {suggestLoading && suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#8a7f72]">Searching…</li>
            ) : (
              suggestions.map((result, index) => (
                <li key={result.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                      index === activeIndex
                        ? 'border border-[#8a7355] bg-[#241c14] text-[#f5d492]'
                        : 'border border-transparent text-[#c9bfb0] hover:border-[#5c534a] hover:bg-[#0a0908]'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToItem(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className={cn('truncate font-[Cinzel]', itemCardRarityClass(result.rarity))}>
                      {result.name}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#8a7f72]">
                      {result.type}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {recentItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recentItems.map((name) => (
            <button
              key={name}
              type="button"
              title={name}
              className="max-w-full truncate border border-[#3a342c] bg-[#0a0908] px-2 py-1 text-[11px] text-[#c9bfb0] transition-colors hover:border-[#8a7355] hover:text-[#f0e6d8]"
              onClick={() => goToRecent(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
