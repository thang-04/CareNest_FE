export const pickupCrumbs = (...rest) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Đón trẻ', to: '/pickup' },
  ...rest.filter(Boolean).map((x) => (typeof x === 'string' ? { label: x } : x)),
];
