/** `linkParent: false` for roles that cannot open the recording screen (Principal, VP, kitchen). */
export const attendanceCrumbs = (last, { linkParent = true } = {}) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Điểm danh & báo ăn', ...(linkParent ? { to: '/attendance' } : {}) },
  ...(last ? [{ label: last }] : []),
];
