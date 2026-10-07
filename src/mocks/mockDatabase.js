import { buildSeedDatabase } from './seed';
import { MOCK_LATENCY_MS } from '@/config/env';

/**
 * localStorage-backed fake backend. Only mock repositories may import this file.
 * UI components never touch localStorage directly.
 */
// v3: school structure (classes, children), Principal account.
const DB_KEY = 'carenest.mockdb.v3';
export const DB_CHANGED_EVENT = 'carenest:db-changed';

let cache = null;

// Another browser tab changed the demo data: drop the in-memory copy.
window.addEventListener('storage', (event) => {
  if (event.key === DB_KEY) cache = null;
});

const load = () => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    // Clone: writes must never mutate the seed objects, or "Khôi phục dữ liệu demo" would restore edited data.
    cache = raw ? JSON.parse(raw) : clone(buildSeedDatabase());
  } catch {
    cache = clone(buildSeedDatabase());
  }
  return cache;
};

const persist = () => {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch (err) {
    throw new ApiError(507, 'Bộ nhớ trình duyệt đã đầy. Hãy dùng ảnh nhỏ hơn hoặc reset dữ liệu demo.');
  }
};

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const clone = (value) => JSON.parse(JSON.stringify(value));

export const delay = (ms = MOCK_LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

/** Read-only snapshot of the database. */
export const readDb = () => load();

/**
 * Runs a mutation as one "transaction": changes are rolled back if the mutator throws.
 */
export const writeDb = (mutator) => {
  const before = JSON.stringify(load());
  try {
    const result = mutator(cache);
    persist();
    window.dispatchEvent(new CustomEvent(DB_CHANGED_EVENT));
    return result;
  } catch (err) {
    cache = JSON.parse(before);
    throw err;
  }
};

export const resetDb = () => {
  cache = clone(buildSeedDatabase());
  persist();
  window.dispatchEvent(new CustomEvent(DB_CHANGED_EVENT));
};
