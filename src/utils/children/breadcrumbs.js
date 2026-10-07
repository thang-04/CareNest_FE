/** Breadcrumbs of the children module: childrenCrumbs({ label, to }, 'Last page'). */
export const childrenCrumbs = (...items) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Hồ sơ trẻ', to: '/children' },
  ...items.filter(Boolean).map((item) => (typeof item === 'string' ? { label: item } : item)),
];

export const childCrumb = (child) => (child ? { label: child.fullName, to: `/children/${child.id}` } : null);
