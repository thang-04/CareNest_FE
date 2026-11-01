const HOME = { label: 'Trang chủ', to: '/' };

/** Breadcrumb for account pages: acCrumbs({ label, to }, ..., 'Current page'). */
export const acCrumbs = (...items) => [HOME, ...items.map((it) => (typeof it === 'string' ? { label: it } : it))];
