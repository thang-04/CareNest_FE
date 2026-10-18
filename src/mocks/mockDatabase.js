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
  const seed = buildSeedDatabase();
  try {
    const raw = localStorage.getItem(DB_KEY);
    // Clone: writes must never mutate the seed objects, or "Khôi phục dữ liệu demo" would restore edited data.
    const parsed = raw ? JSON.parse(raw) : null;
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : clone(seed);
  } catch {
    cache = clone(seed);
  }
  const keys = Object.keys(seed);
  if (needsMockSeedMigration(cache, 'base', 1, keys)) {
    applyMockSeedMigration(cache, 'base', 1, seed);
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(cache));
    } catch {
      // Dữ liệu đã được bù trong bộ nhớ; lần ghi kế tiếp sẽ thử lưu lại.
    }
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

export const needsMockSeedMigration = (db, module, version, keys) =>
  Number(db.mockSeedVersions?.[module] || 0) < version || keys.some((key) => !Array.isArray(db[key]));

export const applyMockSeedMigration = (db, module, version, seeds) => {
  const versions =
    db.mockSeedVersions && typeof db.mockSeedVersions === 'object' && !Array.isArray(db.mockSeedVersions) ? db.mockSeedVersions : {};
  const current = Number(versions[module] || 0);
  Object.entries(seeds).forEach(([key, rows]) => {
    if (!Array.isArray(db[key]) || (current < version && db[key].length === 0)) db[key] = clone(rows);
  });
  db.mockSeedVersions = { ...versions, [module]: Math.max(current, version) };
  return db;
};

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
  cache.mockSeedVersions = { base: 1 };
  persist();
  window.dispatchEvent(new CustomEvent(DB_CHANGED_EVENT));
};
