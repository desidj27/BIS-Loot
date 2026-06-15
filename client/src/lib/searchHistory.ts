export const SEARCH_HISTORY_SIZE = 5;
const STORAGE_KEY = 'marketTracker:searchHistory';

export function readSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, SEARCH_HISTORY_SIZE);
  } catch {
    return [];
  }
}

export function addSearchHistory(itemName: string): string[] {
  const trimmed = itemName.trim();
  if (!trimmed) return readSearchHistory();

  const next = [trimmed, ...readSearchHistory().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    SEARCH_HISTORY_SIZE
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private mode errors.
  }

  return next;
}
