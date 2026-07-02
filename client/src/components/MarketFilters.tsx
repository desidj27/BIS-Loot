import { useEffect, useRef, useState } from 'react';
import type { AttributeFilter, ItemAttributeRange } from '@/api/client';
import AdSlot from '@/components/AdSlot';
import { GameDivider, GamePanel } from '@/components/ui/game-panel';
import { cn } from '@/lib/utils';
import {
  gameButtonPrimaryClass,
  gameHeadingClass,
  gameInputClass,
  gameLabelClass,
  itemCardRarityClass,
} from '@/lib/gameTheme';
import {
  addSearchHistory,
  readSearchHistory,
} from '@/lib/searchHistory';
import {
  attributeInputStep,
  clampAttributeValue,
  GemStatus,
  getAvailableRaritiesForItem,
  ItemSuggestion,
  loadItemAttributeRanges,
  mergePendingAttributeFilter,
  MarketFilterState,
  RARITIES,
  searchItemSuggestions,
} from '@/lib/marketFilters';

interface AttributeMinSliderProps {
  range: ItemAttributeRange;
  value: number;
  onChange: (value: number) => void;
}

function AttributeMinSlider({ range, value, onChange }: AttributeMinSliderProps) {
  const clamped = clampAttributeValue(value, range);

  function formatSliderValue(v: number): string {
    const formatted = Number.isInteger(v) ? String(v) : v.toFixed(1);
    return range.is_percentage ? `${formatted}%` : formatted;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className={gameLabelClass}>Min value</span>
        <span className="text-sm font-semibold text-[#ddd6cb]">{formatSliderValue(clamped)}</span>
      </div>
      <input
        type="range"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a241c] accent-[#c47b1a] [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#e5b56e] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#e5b56e]"
        min={range.min}
        max={range.max}
        step={attributeInputStep(range)}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between text-[10px] text-[#8a7f72]">
        <span>{formatSliderValue(range.min)}</span>
        <span>{formatSliderValue(range.max)}</span>
      </div>
    </div>
  );
}

interface MarketFiltersProps {
  filters: MarketFilterState;
  onChange: (filters: MarketFilterState) => void;
  onSearch: (filters: MarketFilterState) => void;
  loading?: boolean;
}

export default function MarketFilters({
  filters,
  onChange,
  onSearch,
  loading,
}: MarketFiltersProps) {
  const [availableAttributes, setAvailableAttributes] = useState<ItemAttributeRange[]>([]);
  const [attributesLoading, setAttributesLoading] = useState(false);
  const [addingAttribute, setAddingAttribute] = useState(false);
  const [newAttrField, setNewAttrField] = useState('');
  const [newAttrMin, setNewAttrMin] = useState('');
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [quickItems, setQuickItems] = useState<string[]>([]);
  const [availableRarities, setAvailableRarities] = useState<string[]>([...RARITIES]);
  const blurTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtersRef = useRef(filters);

  filtersRef.current = filters;

  useEffect(() => {
    setQuickItems(readSearchHistory());
  }, []);

  useEffect(() => {
    const itemName = filters.itemName.trim();
    if (!itemName) {
      setAvailableRarities([...RARITIES]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      getAvailableRaritiesForItem(itemName)
        .then((rarities) => {
          if (cancelled) return;
          setAvailableRarities(rarities);

          const current = filtersRef.current;
          if (current.rarity && !rarities.includes(current.rarity)) {
            const next = { ...current, rarity: '' };
            filtersRef.current = next;
            onChange(next);
          }
        })
        .catch(() => {
          if (!cancelled) setAvailableRarities([...RARITIES]);
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters.itemName, onChange]);

  function refreshQuickItems() {
    setQuickItems(readSearchHistory());
  }

  const itemSelected = filters.itemName.trim().length > 0;
  const selectedRange = availableAttributes.find((attr) => attr.field === newAttrField);

  useEffect(() => {
    const itemName = filters.itemName.trim();
    if (!itemName) {
      setAvailableAttributes([]);
      setAttributesLoading(false);
      return;
    }

    setAttributesLoading(true);
    const timer = window.setTimeout(() => {
      loadItemAttributeRanges(itemName, filters.rarity || undefined)
        .then((ranges) => {
          setAvailableAttributes(ranges);
          const current = filtersRef.current;
          const nextAttributes = current.attributes
            .filter((attr) => ranges.some((range) => range.field === attr.field))
            .map((attr) => {
              const range = ranges.find((entry) => entry.field === attr.field);
              if (!range || attr.min === undefined) return attr;
              return {
                ...attr,
                min: clampAttributeValue(attr.min, range),
              };
            });

          const changed =
            nextAttributes.length !== current.attributes.length ||
            nextAttributes.some((attr, index) => {
              const prev = current.attributes[index];
              return !prev || prev.field !== attr.field || prev.min !== attr.min;
            });

          if (changed) {
            const next = { ...current, attributes: nextAttributes };
            filtersRef.current = next;
            onChange(next);
          }
        })
        .catch(() => setAvailableAttributes([]))
        .finally(() => setAttributesLoading(false));
    }, 200);

    return () => window.clearTimeout(timer);
  }, [filters.itemName, filters.rarity, onChange]);

  useEffect(() => {
    const query = filters.itemName.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);
    const timer = window.setTimeout(() => {
      searchItemSuggestions(query)
        .then((results) => {
          setSuggestions(results);
          setActiveIndex(-1);
          setSuggestOpen(results.length > 0);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestLoading(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [filters.itemName]);

  function update(partial: Partial<MarketFilterState>) {
    const next = { ...filtersRef.current, ...partial };
    if (partial.itemName !== undefined && !partial.itemName.trim()) {
      next.attributes = [];
    }
    filtersRef.current = next;
    onChange(next);
  }

  function selectSuggestion(suggestion: ItemSuggestion) {
    update({ itemName: suggestion.name });
    setSuggestOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function clearItemName() {
    update({ itemName: '', attributes: [] });
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveIndex(-1);
    setAddingAttribute(false);
    setNewAttrField('');
    setNewAttrMin('');
    inputRef.current?.focus();
  }

  function buildEffectiveFilters(): MarketFilterState {
    const pending =
      addingAttribute && newAttrField ? { field: newAttrField, min: newAttrMin } : null;
    return mergePendingAttributeFilter(filtersRef.current, pending, availableAttributes);
  }

  function selectQuickItem(name: string) {
    update({ itemName: name, attributes: [] });
    setSuggestOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function commitSearch() {
    const effective = buildEffectiveFilters();
    const current = filtersRef.current;
    const addedPending =
      effective.attributes.length > current.attributes.length ||
      effective.attributes.some(
        (attr, index) =>
          attr.field !== current.attributes[index]?.field ||
          attr.min !== current.attributes[index]?.min
      );

    if (addedPending) {
      filtersRef.current = effective;
      onChange(effective);
      setAddingAttribute(false);
      setNewAttrField('');
      setNewAttrMin('');
    }

    if (effective.itemName.trim()) {
      addSearchHistory(effective.itemName.trim());
      refreshQuickItems();
    }

    onSearch(effective);
  }

  function handleItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      if (!suggestOpen || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }

    if (e.key === 'ArrowUp') {
      if (!suggestOpen || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }

    if (e.key === 'Escape') {
      setSuggestOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(suggestions[activeIndex]);
      } else {
        setSuggestOpen(false);
        commitSearch();
      }
    }
  }

  function handleAttributeSelect(field: string) {
    setNewAttrField(field);
    const range = availableAttributes.find((attr) => attr.field === field);
    setNewAttrMin(range ? String(range.min) : '');
  }

  function handleMinChange(value: string) {
    if (!selectedRange) return;

    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    setNewAttrMin(String(clampAttributeValue(parsed, selectedRange)));
  }

  const sliderValue = selectedRange
    ? newAttrMin === ''
      ? selectedRange.min
      : clampAttributeValue(Number(newAttrMin), selectedRange)
    : 0;

  function addAttributeFilter() {
    const attr = availableAttributes.find((a) => a.field === newAttrField);
    if (!attr) return;
    if (filters.attributes.some((a) => a.field === attr.field)) return;

    let min: number | undefined;
    if (newAttrMin !== '') {
      const parsed = Number(newAttrMin);
      if (!Number.isNaN(parsed)) {
        min = clampAttributeValue(parsed, attr);
      }
    } else {
      min = attr.min;
    }

    const next: AttributeFilter = {
      field: attr.field,
      display: attr.display,
      min,
    };

    update({ attributes: [...filters.attributes, next] });
    setNewAttrField('');
    setNewAttrMin('');
    setAddingAttribute(false);
  }

  function updateAttributeMin(field: string, min: number) {
    const range = availableAttributes.find((attr) => attr.field === field);
    if (!range) return;

    const clamped = clampAttributeValue(min, range);
    update({
      attributes: filtersRef.current.attributes.map((attr) =>
        attr.field === field ? { ...attr, min: clamped } : attr
      ),
    });
  }

  function removeAttribute(field: string) {
    update({ attributes: filters.attributes.filter((a) => a.field !== field) });
  }

  const unusedAttributes = availableAttributes.filter(
    (attr) => !filters.attributes.some((filter) => filter.field === attr.field)
  );

  const showDropdown =
    suggestOpen && filters.itemName.trim().length >= 2 && (suggestions.length > 0 || suggestLoading);

  const attributesHint = !itemSelected
    ? 'Select an item to view available attributes.'
    : attributesLoading
      ? 'Loading attributes for this item…'
      : availableAttributes.length === 0
        ? 'No rollable attributes found for this item.'
        : null;

  return (
    <GamePanel className="p-3 sm:sticky sm:top-[4.5rem] sm:p-4 lg:top-20">
      <h3 className={gameHeadingClass}>Market Filters</h3>
      <GameDivider className="px-0" />

      <div className="relative flex flex-col gap-1.5">
        <span className={gameLabelClass}>Item Name</span>
        <div className="relative">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls="item-name-suggestions"
            placeholder="Search item name…"
            className={cn(gameInputClass, 'pr-8')}
            value={filters.itemName}
            onChange={(e) => {
              update({ itemName: e.target.value });
              setSuggestOpen(true);
            }}
            onFocus={() => {
              if (blurTimer.current) window.clearTimeout(blurTimer.current);
              if (suggestions.length > 0) setSuggestOpen(true);
            }}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setSuggestOpen(false), 150);
            }}
            onKeyDown={handleItemKeyDown}
          />
          {filters.itemName && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearItemName}
              aria-label="Clear item name"
            >
              ×
            </button>
          )}
        </div>

        {showDropdown && (
          <ul
            id="item-name-suggestions"
            className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-xl"
            role="listbox"
          >
            {suggestLoading && suggestions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-neutral-500">Searching…</li>
            ) : (
              suggestions.map((suggestion, index) => (
                <li key={suggestion.name} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                      index === activeIndex
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-300 hover:bg-neutral-800/60'
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span>{suggestion.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {suggestion.type}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {quickItems.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={gameLabelClass}>Recent</span>
          <div className="flex flex-wrap gap-1.5">
            {quickItems.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                className={cn(
                  'max-w-full truncate border border-[#3a342c] bg-[#0a0908] px-2.5 py-1.5 text-xs text-[#c9bfb0] transition-colors sm:px-2 sm:py-1 sm:text-[11px]',
                  'hover:border-[#8a7355] hover:text-[#f0e6d8]',
                  filters.itemName.trim().toLowerCase() === name.toLowerCase() &&
                    'border-[#8a7355] text-[#e5b56e]'
                )}
                onClick={() => selectQuickItem(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={gameLabelClass}>Rarity</span>
        <select
          className={gameInputClass}
          value={filters.rarity}
          onChange={(e) => update({ rarity: e.target.value })}
        >
          <option value="">Any Rarity</option>
          {availableRarities.map((r) => (
            <option key={r} value={r} className={itemCardRarityClass(r)}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={gameLabelClass}>Gem Status</span>
        <div className="grid grid-cols-3 gap-1 border border-[#3a342c] bg-[#0a0908] p-1">
          {(
            [
              ['any', 'Any'],
              ['gemmed', 'Gemmed'],
              ['no_gems', 'No Gems'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                'min-h-10 py-2.5 text-xs font-medium transition-colors sm:min-h-0 sm:py-1.5',
                filters.gems === value
                  ? 'border border-[#8a7355] bg-[#241c14] text-[#e5b56e]'
                  : 'border border-transparent text-[#8a7f72] hover:text-[#ddd6cb]'
              )}
              onClick={() => update({ gems: value as GemStatus })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={gameLabelClass}>Attributes</span>

        {filters.attributes.length === 0 && !addingAttribute && attributesHint && (
          <p className="text-xs italic text-neutral-600">{attributesHint}</p>
        )}

        {filters.attributes.length > 0 && (
          <div className="flex flex-col gap-2">
            {filters.attributes.map((attr) => {
              const range = availableAttributes.find((entry) => entry.field === attr.field);
              const minValue = attr.min ?? range?.min ?? 0;

              return (
                <div
                  key={attr.field}
                  className="space-y-3 border border-[#3a342c] bg-[#0a0908] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#ddd6cb]">{attr.display}</span>
                    <button
                      type="button"
                      className="text-[#8a7f72] hover:text-[#ddd6cb]"
                      onClick={() => removeAttribute(attr.field)}
                      aria-label={`Remove ${attr.display} filter`}
                    >
                      ×
                    </button>
                  </div>
                  {range ? (
                    <AttributeMinSlider
                      range={range}
                      value={minValue}
                      onChange={(value) => updateAttributeMin(attr.field, value)}
                    />
                  ) : (
                    <p className="text-xs text-[#8a7f72]">
                      {attr.min !== undefined ? `≥ ${attr.min}` : 'Any value'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {addingAttribute ? (
          <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
            <select
              className={gameInputClass}
              value={newAttrField}
              onChange={(e) => handleAttributeSelect(e.target.value)}
            >
              <option value="">Select attribute…</option>
              {unusedAttributes.map((attr) => (
                <option key={attr.field} value={attr.field}>
                  {attr.display}
                </option>
              ))}
            </select>
            {selectedRange ? (
              <AttributeMinSlider
                range={selectedRange}
                value={sliderValue}
                onChange={(value) => handleMinChange(String(value))}
              />
            ) : (
              <p className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-xs text-neutral-600">
                Select an attribute to set a minimum value.
              </p>
            )}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-neutral-800 bg-neutral-900/50 p-1">
              <button
                type="button"
                className="rounded-md py-2 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-40"
                onClick={addAttributeFilter}
                disabled={!newAttrField}
              >
                Add
              </button>
              <button
                type="button"
                className="rounded-md py-2 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
                onClick={() => setAddingAttribute(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className={cn(
              'w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5 text-sm font-medium transition-colors',
              'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-900/50 disabled:hover:text-neutral-400'
            )}
            disabled={!itemSelected || availableAttributes.length === 0 || attributesLoading}
            onClick={() => setAddingAttribute(true)}
          >
            + Add Filter
          </button>
        )}
      </div>

      <div className="border-t border-[#3a342c] pt-1">
        <button
          type="button"
          className={gameButtonPrimaryClass}
          disabled={loading}
          onClick={commitSearch}
        >
          {loading ? 'Searching…' : 'Search Market'}
        </button>
      </div>

      <AdSlot placement="marketSidebar" format="vertical" className="mt-4" />
    </GamePanel>
  );
}
