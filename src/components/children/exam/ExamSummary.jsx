import { Fragment } from 'react';
import {
  CLINICAL_GROUPS,
  COMPANION_OPTIONS,
  DEVELOPMENT_ITEMS,
  HEAD_STATUS_OPTIONS,
  HISTORY_ITEMS,
  IMMUNIZATION_ITEMS,
  ISSUE_KIND_LABELS,
  NUTRITION_STATUS_OPTIONS,
  VITAL_ITEMS,
  YES_NO,
  conclusionActionLabelOf,
  conclusionLabelOf,
  labelOf,
} from '@/models/children/healthExamForm';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatDecimal } from '@/utils/children/healthExamHints';
import { profileRows } from './ExamAdminStep';
import { vitalReferenceText } from './ExamMeasureStep';
import { EXAM_SECTIONS, ExamSheetBand, ExamSheetRows, ExamSheetTable } from './ExamFields';

const isBlank = (v) => v === '' || v == null;
const blank = <span className="muted">—</span>;
const show = (v, unit = '') => (isBlank(v) ? blank : `${typeof v === 'number' ? formatDecimal(v) : v}${unit}`);

/** Giá trị một câu theo lựa chọn của mẫu; lựa chọn bất thường hiện dạng chip cảnh báo. */
function Choice({ options, value }) {
  const o = options.find((x) => x.value === value);
  if (!o) return blank;
  return o.abnormal ? <span className="chip chip--orange">{o.label}</span> : o.label;
}

const textRow = (key, label, value, className) => ({ key, label, cell: <td className={className}>{value}</td> });
const choiceRows = (items, values) =>
  items.map((item) => textRow(item.key, item.label, <Choice options={item.options} value={values[item.key]} />));

/**
 * Phiếu Phụ lục II chỉ đọc (đã kết luận, hoặc người xem không nhập được): một bảng liền như form (TT, nội dung kiểm tra, kết quả;
 * không dòng tiêu đề cột), dải phần I → VI → Kết luận, giá trị là chữ. CCCD chỉ hiện ở đây. framed=false (hộp xem phiếu ở Sổ sức khỏe): chỉ bảng, không card.
 * reference: khoảng tham khảo BE trả theo tuổi ở ngày khám, hiện dưới số sinh tồn.
 */
export function ExamSummary({ measurement: m, child, campaign, reference, framed = true }) {
  const e = m.exam;
  const a = e.admin;
  const h = e.history;
  const n = e.nutrition;
  const c = e.conclusion;
  const companion = a.hasCompanion === YES_NO.YES;

  const companionRows = [
    textRow('hasCompanion', 'Có người đi cùng trẻ khi khám', labelOf(COMPANION_OPTIONS, a.hasCompanion) || blank),
    companion && textRow('companionName', 'Họ tên', show(a.companion.fullName), 'fw-600'),
    companion && textRow('companionRelation', 'Mối quan hệ với trẻ', show(a.companion.relation)),
    companion && textRow('companionPhone', 'Số điện thoại liên hệ', show(a.companion.phone)),
    companion && textRow('companionId', 'Số CC/CCCD/Mã định danh', show(a.companion.idNumber)),
  ];
  const historyRows = HISTORY_ITEMS.map((item) => {
    const detail = h[item.key] === YES_NO.YES && (h[item.textKey] || (h[item.dateKey] && formatDate(h[item.dateKey])));
    return textRow(
      item.key,
      item.label,
      <>
        <Choice options={item.options} value={h[item.key]} />
        {detail && ` · ${item.textKey ? item.textLabel : item.dateLabel}: ${detail}`}
      </>,
    );
  });
  const vitalRows = VITAL_ITEMS.map((item) =>
    textRow(
      item.key,
      item.label,
      <>
        {show(e.vitals[item.key])} · <Choice options={item.options} value={e.vitals[item.statusKey]} />
        {reference && <span className="field__hint">{vitalReferenceText(item, reference.vitals)}</span>}
      </>,
    ),
  );
  const nutritionRows = [
    textRow('height', 'Chiều cao/chiều dài (cm)', show(m.heightCm)),
    textRow('lengthForAge', 'Chiều dài/Tuổi (SD)', show(n.lengthForAgeSd)),
    textRow('weight', 'Cân nặng (kg)', show(m.weightKg)),
    textRow('weightForAge', 'Cân nặng/Tuổi (SD)', show(n.weightForAgeSd)),
    textRow(
      'head',
      'Vòng đầu (cm)',
      m.headCircumferenceCm == null ? (
        <span className="muted">Không đo</span>
      ) : (
        <>
          {show(m.headCircumferenceCm)} · <Choice options={HEAD_STATUS_OPTIONS} value={n.headStatus} />
        </>
      ),
    ),
    textRow('arm', 'Chu vi vòng cánh tay (mm)', show(n.armCircumferenceMm)),
    textRow('bmi', 'BMI (hệ thống tính)', show(m.bmi)),
    textRow(
      'statuses',
      'Tình trạng dinh dưỡng (theo bác sĩ)',
      n.statuses.length === 0 ? (
        blank
      ) : (
        <div className="row row--wrap gap-2">
          {n.statuses.map((st) => (
            <Fragment key={st}>
              <Choice options={NUTRITION_STATUS_OPTIONS} value={st} />
            </Fragment>
          ))}
        </div>
      ),
    ),
  ];
  const conclusionRows = [
    textRow(
      'conclusion',
      c.followUpFinding ? 'So với vấn đề đang theo dõi' : 'Kết luận về sức khỏe',
      conclusionLabelOf(c) || blank,
      'fw-600',
    ),
    c.issueText && textRow('issueText', c.followUpFinding ? 'Ghi rõ vấn đề' : 'Ghi rõ vấn đề sức khỏe', c.issueText, 'tr-pre-line'),
    c.issueKind && textRow('issueKind', 'Vấn đề này', ISSUE_KIND_LABELS[c.issueKind]),
    textRow('action', 'Cần được tư vấn/chuyển khám chuyên khoa', conclusionActionLabelOf(c) || blank),
    c.adviceText && textRow('adviceText', 'Lời tư vấn của bác sĩ', c.adviceText, 'tr-pre-line'),
    textRow('doctor', 'Bác sĩ kết luận', c.doctorName || blank),
    c.parentOpinion && textRow('parentOpinion', 'Ý kiến phụ huynh', c.parentOpinion, 'tr-pre-line'),
    textRow(
      'measuredBy',
      'Người nhập phiếu',
      `${m.measuredByName || '—'}${m.concludedAt ? ` · lưu kết luận ${formatDateTime(m.concludedAt)}` : ''}`,
    ),
  ];

  const sheet = (
    <ExamSheetTable label="Phiếu kiểm tra sức khỏe">
      <ExamSheetBand primary>{EXAM_SECTIONS.admin}</ExamSheetBand>
      <ExamSheetRows rows={profileRows({ child, admin: a, campaign, blank, dateCell: <td>{formatDate(m.date)}</td> })} />
      <ExamSheetBand>Người đi cùng trẻ</ExamSheetBand>
      <ExamSheetRows rows={companionRows} />
      <ExamSheetBand>Tiền sử</ExamSheetBand>
      <ExamSheetRows rows={historyRows} />
      <ExamSheetBand primary>{EXAM_SECTIONS.vitals}</ExamSheetBand>
      <ExamSheetRows rows={vitalRows} />
      <ExamSheetBand primary>{EXAM_SECTIONS.nutrition}</ExamSheetBand>
      <ExamSheetRows rows={nutritionRows} />
      <ExamSheetBand primary>{EXAM_SECTIONS.development}</ExamSheetBand>
      <ExamSheetRows
        rows={choiceRows(
          DEVELOPMENT_ITEMS.filter((i) => !i.ageMonths || e.development[i.key]),
          e.development,
        )}
      />
      <ExamSheetBand primary>{EXAM_SECTIONS.immunization}</ExamSheetBand>
      <ExamSheetRows rows={choiceRows(IMMUNIZATION_ITEMS, e.immunization)} />
      <ExamSheetBand primary>{EXAM_SECTIONS.clinical}</ExamSheetBand>
      {CLINICAL_GROUPS.map((group, gi) => (
        <Fragment key={group.key}>
          <ExamSheetBand>{group.title}</ExamSheetBand>
          <ExamSheetRows
            rows={[
              ...choiceRows(group.items, e.clinical),
              gi === CLINICAL_GROUPS.length - 1 &&
                e.clinical.behaviorNote &&
                textRow('behaviorNote', 'Nếu có, ghi rõ', e.clinical.behaviorNote, 'tr-pre-line'),
            ]}
          />
        </Fragment>
      ))}
      <ExamSheetBand primary>{EXAM_SECTIONS.conclusion}</ExamSheetBand>
      <ExamSheetRows rows={conclusionRows} />
    </ExamSheetTable>
  );
  if (!framed) return sheet;
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Phiếu kiểm tra sức khỏe</h2>
      </div>
      <div className="card__body">{sheet}</div>
    </section>
  );
}
