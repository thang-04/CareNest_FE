const ROOT = [{ label: 'Trang chủ', to: '/' }, { label: 'Đánh giá trẻ' }];

/** assessmentCrumbs({ label: 'Đánh giá định kỳ', to: '/assessment/periodic' }, 'Chi tiết') */
export const assessmentCrumbs = (section, last) => [...ROOT, ...(section ? [section] : []), ...(last ? [{ label: last }] : [])];

export const SECTIONS = {
  daily: { label: 'Đánh giá hằng ngày', to: '/assessment/daily' },
  overview: { label: 'Tổng quan đánh giá lớp', to: '/assessment/overview' },
  quality: { label: 'Chất lượng tháng', to: '/assessment/quality-report' },
  classRatings: { label: 'Xếp loại nhóm lớp', to: '/assessment/class-ratings' },
  unlocks: { label: 'Mở lại đánh giá', to: '/assessment/day-unlocks' },
  children: { label: 'Hồ sơ phát triển', to: '/assessment/children' },
  periodic: { label: 'Đánh giá tháng', to: '/assessment/periodic' },
  semester: { label: 'Đánh giá học kỳ', to: '/assessment/semester' },
  themes: { label: 'Đánh giá cuối chủ đề', to: '/assessment/themes' },
  yearEnd: { label: 'Đánh giá cuối năm', to: '/assessment/year-end' },
  tickets: { label: 'Phiếu bé ngoan', to: '/assessment/tickets' },
  weeklyComments: { label: 'Nhận xét tuần', to: '/assessment/weekly-comments' },
  rewards: { label: 'Đề xuất khen thưởng', to: '/assessment/rewards' },
};
