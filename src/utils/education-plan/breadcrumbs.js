const HOME = { label: 'Trang chủ', to: '/' };

/** Breadcrumb for education-plan pages: eduCrumbs({ label, to }, ..., 'Current page'). */
export const eduCrumbs = (...items) => [HOME, ...items.map((it) => (typeof it === 'string' ? { label: it } : it))];
