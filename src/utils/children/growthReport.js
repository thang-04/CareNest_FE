import { CAMPAIGN_KIND_LABELS, CAMPAIGN_STATUS, CAMPAIGN_STATUS_LABELS } from '@/models/children/healthCheckConstants';
import { formatDate } from '@/utils/format';

/*
 * Bố cục dùng chung của báo cáo tổng hợp cân đo mẫu 5.1 cho bảng trên trang và file Excel
 * (plan docs/plans/active/2026-11-04-health-growth-report.md). Số trẻ do BE trả (GET /health-checks/growth-report); ở đây chỉ
 * tính tỉ lệ để hiển thị: tỉ lệ cân đo = được cân đo ÷ trẻ của lớp, tỉ lệ từng nhóm = số trẻ của nhóm ÷ được cân đo.
 */

export const GROWTH_REPORT_TITLE = 'Kết quả theo dõi cân nặng, chiều cao';
export const GROWTH_REPORT_SUBTITLE = 'Mẫu 5.1 · cân nặng – chiều cao – cân nặng/chiều cao (BMI)';
export const GROWTH_SHEET_TITLE = '5.1. Kết quả theo dõi cân nặng - chiều cao - cân nặng/chiều cao (BMI)';
export const GROWTH_EMPTY_CAMPUS = 'Chưa có kỳ cân đo hoặc đợt khám trong tháng này';

/** Nhóm chỉ số theo mẫu 5.1; warn: số khác 0 tô chữ cảnh báo. */
export const GROWTH_GROUPS = [
  {
    key: 'weight',
    label: 'Theo dõi cân nặng',
    items: [
      { key: 'weightNormal', label: 'PTBT' },
      { key: 'underweight', label: 'SDDNC', warn: true },
    ],
  },
  {
    key: 'height',
    label: 'Theo dõi chiều cao',
    items: [
      { key: 'heightNormal', label: 'PTBT' },
      { key: 'stunted', label: 'SDDTC', warn: true },
    ],
  },
  {
    key: 'bmi',
    label: 'Theo dõi cân nặng/chiều cao (BMI)',
    items: [
      { key: 'bmiNormal', label: 'TS trẻ BT' },
      { key: 'wasted', label: 'SDD thể GC', warn: true },
      { key: 'overweight', label: 'Thừa cân', warn: true },
      { key: 'obese', label: 'Béo phì', warn: true },
    ],
  },
];
export const GROWTH_ITEMS = GROWTH_GROUPS.flatMap((g) => g.items);
/** Số cột của bảng: TT, Tên lớp, TS trẻ của lớp, TS trẻ được cân đo, Tỉ lệ %, rồi Tổng số + Tỷ lệ % của từng chỉ số. */
export const GROWTH_COLUMN_COUNT = 5 + GROWTH_ITEMS.length * 2;

/** Tỉ lệ % một chữ số thập phân; null khi mẫu số bằng 0. */
export const pctOf = (count, denominator) => (denominator > 0 ? Math.round((count * 1000) / denominator) / 10 : null);

const PCT_FORMAT = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** 85.7 ⇒ '85,7'; null ⇒ '–'. */
export const formatPct = (value) => (value == null ? '–' : PCT_FORMAT.format(value));

/** '2026-11' ⇒ 'Tháng 11/2026'. */
export const monthLabelOf = (month) => (month ? `Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}` : '');

/** Tên ngắn của điểm trường ('Campus 1 - Trường …' ⇒ 'Campus 1'), như danh sách đợt khám. */
export const campusShortName = (name) => String(name || '').split(' - ')[0];

/** Kỳ/đợt chưa đóng: số liệu của tháng còn thay đổi. */
export const isProvisionalCampaign = (c) => c.status === CAMPAIGN_STATUS.IN_PROGRESS || c.status === CAMPAIGN_STATUS.UPCOMING;

/** 'Kỳ cân đo: Cân đo định kỳ tháng 11/2026 (02/11/2026 – 09/11/2026, đang diễn ra)'. */
export const campaignLineOf = (c) =>
  `${CAMPAIGN_KIND_LABELS[c.kind] || ''}: ${c.name} (${formatDate(c.startDate)} – ${formatDate(c.endDate)}, ${(
    CAMPAIGN_STATUS_LABELS[c.status] || c.status
  ).toLowerCase()})`;

/** Giá trị một dòng số: { enrolled, measured, coverage, items: [{ key, count, pct, warn }] }. */
export const rowValuesOf = (counts) => ({
  enrolled: counts.enrolled,
  measured: counts.measured,
  coverage: pctOf(counts.measured, counts.enrolled),
  items: GROWTH_ITEMS.map((it) => ({
    key: it.key,
    count: counts[it.key],
    pct: pctOf(counts[it.key], counts.measured),
    warn: !!it.warn && counts[it.key] > 0,
  })),
});

/**
 * Các dòng của bảng theo thứ tự hiển thị. kind: band (dải điểm trường) | class | subtotal (Tổng MG, Tổng NT) | campusTotal |
 * empty (điểm trường không có kỳ/đợt trong tháng) | grandTotal (khi có hơn 1 điểm trường). TT đánh lại từ 1 ở mỗi điểm trường.
 */
export const growthReportRowsOf = (report) => {
  const campuses = report?.campuses || [];
  const rows = campuses.flatMap((campus) => {
    const band = {
      kind: 'band',
      key: `band-${campus.campusId}`,
      label: campus.campusName,
      campaigns: campus.campaigns,
      provisional: campus.campaigns.some(isProvisionalCampaign),
    };
    if (!campus.campaigns.length) return [band, { kind: 'empty', key: `empty-${campus.campusId}`, label: GROWTH_EMPTY_CAMPUS }];
    return [
      band,
      ...campus.classes.map((cls, i) => ({
        kind: 'class',
        key: `${campus.campusId}-${cls.classId}`,
        tt: i + 1,
        label: cls.className,
        counts: cls.counts,
      })),
      { kind: 'subtotal', key: `mg-${campus.campusId}`, label: 'Tổng MG', counts: campus.preschool },
      { kind: 'subtotal', key: `nt-${campus.campusId}`, label: 'Tổng NT', counts: campus.nursery },
      { kind: 'campusTotal', key: `total-${campus.campusId}`, label: `Tổng ${campusShortName(campus.campusName)}`, counts: campus.total },
    ];
  });
  if (campuses.length > 1) rows.push({ kind: 'grandTotal', key: 'grand-total', label: 'Tổng toàn trường', counts: report.total });
  return rows;
};

/** Ghi chú dưới bảng (trang và Excel dùng chung). */
export const growthReportNotesOf = (report) => {
  const unclassified = report?.total?.unclassified || 0;
  return [
    'Viết tắt: TT – thứ tự; TS – tổng số; PTBT – phát triển bình thường; SDDNC – suy dinh dưỡng thể nhẹ cân; SDDTC – suy dinh dưỡng thể thấp còi; BT – bình thường; SDD thể GC – suy dinh dưỡng thể gầy còm; MG – mẫu giáo; NT – nhà trẻ.',
    'Chuẩn tăng trưởng WHO: cân nặng theo tuổi dưới −2SD là SDD thể nhẹ cân; chiều cao theo tuổi dưới −2SD là SDD thể thấp còi; BMI theo tuổi dưới −2SD là SDD thể gầy còm. Thừa cân, béo phì theo BMI theo tuổi: đến 60 tháng trên +2SD là thừa cân, trên +3SD là béo phì; từ 61 tháng trên +1SD là thừa cân, trên +2SD là béo phì.',
    'Tỉ lệ cân đo = số trẻ được cân đo ÷ tổng số trẻ của lớp; tỉ lệ từng nhóm = số trẻ của nhóm ÷ số trẻ được cân đo. Trẻ đo nhiều lần trong tháng tính theo lần đo gần nhất.',
    'Nguy cơ thừa cân (trẻ ≤ 5 tuổi) tính vào BT.',
    ...(unclassified
      ? [
          `${unclassified} trẻ được cân đo chưa xếp được nhóm (thiếu giới tính, ngày sinh hoặc ngoài 0–84 tháng tuổi) nên không tính vào nhóm nào.`,
        ]
      : []),
  ];
};

/** Kỳ/đợt dùng cho từng điểm trường: [{ campus, lines }]. */
export const growthReportSourcesOf = (report) =>
  (report?.campuses || []).map((campus) => ({
    campusId: campus.campusId,
    campus: campusShortName(campus.campusName),
    lines: campus.campaigns.length ? campus.campaigns.map(campaignLineOf) : [GROWTH_EMPTY_CAMPUS],
  }));
