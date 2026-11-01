export const transferCrumbs = (last) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Cơ sở vật chất' },
  { label: 'Luân chuyển tài sản', to: '/facility/transfers' },
  ...(last ? [{ label: last }] : []),
];
