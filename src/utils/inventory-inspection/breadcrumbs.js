export const inspectionCrumbs = (last) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Cơ sở vật chất' },
  { label: 'Kiểm kê tài sản', to: '/facility/inspections' },
  ...(last ? [{ label: last }] : []),
];
