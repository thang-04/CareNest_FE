import { Link } from 'react-router-dom';
import { GENDER_LABELS } from '@/models/School';
import { PARENT_CONTACT_STATUS } from '@/models/children/healthCheckConstants';
import {
  CLINICAL_GROUPS,
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
} from '@/models/children/healthExamForm';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatDecimal } from '@/utils/children/healthExamHints';
import { ParentContactBadge } from '../ChildBadges';
import { SplitInfoList } from './SplitInfoList';

const isBlank = (v) => v === '' || v == null;
const show = (v, unit = '') => (isBlank(v) ? <span className="muted">—</span> : `${typeof v === 'number' ? formatDecimal(v) : v}${unit}`);
const yesNo = (v) => (v === YES_NO.YES ? 'Có' : v === YES_NO.NO ? 'Không' : null);

/** Giá trị một câu theo lựa chọn của mẫu; lựa chọn bất thường hiện dạng chip cảnh báo. */
function Choice({ options, value }) {
  const o = options.find((x) => x.value === value);
  if (!o) return <span className="muted">—</span>;
  return o.abnormal ? <span className="chip chip--orange">{o.label}</span> : o.label;
}

const row = (key, label, value, className) => ({ key, label, value, className });

/** Phiếu mức Cần theo dõi sát: đã trao đổi với phụ huynh chưa (BE trả parentContact, user chốt 2026-10-23). */
function ParentContact({ contact, followUpId }) {
  return (
    <div className="tr-cell-stack">
      <ParentContactBadge status={contact.contacted ? PARENT_CONTACT_STATUS.CONTACTED : PARENT_CONTACT_STATUS.NOT_CONTACTED} />
      <span className="muted text-sm">
        {contact.atExam
          ? 'Tại buổi khám, với người đi cùng.'
          : contact.contacted
            ? `Ngày ${formatDate(contact.on)}, ghi trong phiếu theo dõi.`
            : 'Không có người đi cùng: giáo viên trao đổi với phụ huynh rồi ghi vào phiếu theo dõi.'}{' '}
        {followUpId && (
          <Link className="text-primary" to={`/children/health-follow-ups/${followUpId}`}>
            Mở phiếu theo dõi
          </Link>
        )}
      </span>
    </div>
  );
}

/** Một phần của phiếu; màn rộng chia đôi danh sách cho đỡ trống (user yêu cầu 2026-10-22). */
function Section({ title, rows }) {
  return (
    <section className="tr-exam-section">
      <h3 className="subsection-title">{title}</h3>
      <SplitInfoList rows={rows} />
    </section>
  );
}

/** Phiếu Phụ lục II chỉ đọc (đã kết luận, hoặc người xem không nhập được). CCCD chỉ hiện ở đây. */
export function ExamSummary({ measurement: m, child, campaign }) {
  const e = m.exam;
  const a = e.admin;
  const c = e.conclusion;
  const choiceRow = (prefix, values) => (i) =>
    row(
      `${prefix}.${i.key}`,
      prefix === 'immunization' ? `Tiêm chủng — ${i.label}` : i.label,
      <Choice options={i.options} value={values[i.key]} />,
    );
  return (
    <div className="tr-exam-summary">
      <Section
        title="I. Thông tin hành chính"
        rows={[
          row('name', 'Họ và tên', child.fullName.toUpperCase(), 'fw-600'),
          row('idNumber', 'Số CC/CCCD/Hộ chiếu/Mã định danh', show(a.childIdNumber)),
          row('dob', 'Ngày sinh · Giới', `${formatDate(child.dateOfBirth)} · ${GENDER_LABELS[child.gender] || child.gender}`),
          row(
            'premature',
            'Sinh non · Tuần thai khi sinh',
            <>
              {yesNo(a.premature) || '—'} · {show(a.gestationWeeks, ' tuần')}
            </>,
          ),
          row(
            'ethnicity',
            'Dân tộc · Đối tượng',
            <>
              {show(a.ethnicity)} · {show(a.beneficiary)}
            </>,
          ),
          row('bloodType', 'Nhóm máu', show(a.bloodType)),
          row('address', 'Nơi ở hiện tại', show([a.address.street, a.address.ward, a.address.province].filter(Boolean).join(', '))),
          row('school', 'Cơ sở giáo dục', `${child.schoolName} · ${child.className}`),
          row(
            'companion',
            'Người đi cùng trẻ',
            a.hasCompanion === YES_NO.YES ? (
              <>
                {a.companion.fullName} ({a.companion.relation}){a.companion.phone ? ` · ${a.companion.phone}` : ''}
                {a.companion.idNumber ? ` · CCCD ${a.companion.idNumber}` : ''}
              </>
            ) : (
              'Không có người đi cùng'
            ),
          ),
          row('examDate', 'Ngày · Cơ sở kiểm tra sức khỏe', `${formatDate(m.date)} · ${campaign.examiner || '—'}`),
          ...HISTORY_ITEMS.map((i) =>
            row(
              `history.${i.key}`,
              i.label,
              <>
                <Choice options={i.options} value={e.history[i.key]} />
                {i.textKey && e.history[i.textKey] ? ` — ${e.history[i.textKey]}` : ''}
                {i.dateKey && e.history[i.dateKey] ? ` — gần nhất ngày ${formatDate(e.history[i.dateKey])}` : ''}
              </>,
            ),
          ),
        ]}
      />

      <Section
        title="II. Dấu hiệu sinh tồn"
        rows={VITAL_ITEMS.map((i) =>
          row(
            i.key,
            i.label,
            <>
              {show(e.vitals[i.key])} · <Choice options={i.options} value={e.vitals[i.statusKey]} />
            </>,
          ),
        )}
      />

      <Section
        title="III. Dinh dưỡng"
        rows={[
          row(
            'height',
            'Chiều cao/chiều dài · Chiều dài/Tuổi',
            <>
              {show(m.heightCm, ' cm')} · {show(e.nutrition.lengthForAgeSd, ' SD')}
            </>,
          ),
          row(
            'weight',
            'Cân nặng · Cân nặng/Tuổi',
            <>
              {show(m.weightKg, ' kg')} · {show(e.nutrition.weightForAgeSd, ' SD')}
            </>,
          ),
          row(
            'head',
            'Vòng đầu',
            m.headCircumferenceCm == null ? (
              <span className="muted">Không đo</span>
            ) : (
              <>
                {show(m.headCircumferenceCm, ' cm')} · <Choice options={HEAD_STATUS_OPTIONS} value={e.nutrition.headStatus} />
              </>
            ),
          ),
          row('arm', 'Chu vi vòng cánh tay', show(e.nutrition.armCircumferenceMm, ' mm')),
          row('bmi', 'BMI (hệ thống tính)', show(m.bmi)),
          row(
            'statuses',
            'Tình trạng dinh dưỡng',
            e.nutrition.statuses.length === 0 ? (
              <span className="muted">—</span>
            ) : (
              e.nutrition.statuses.map((st) => <Choice key={st} options={NUTRITION_STATUS_OPTIONS} value={st} />)
            ),
            'row row--wrap gap-2',
          ),
        ]}
      />

      <Section
        title="IV–V. Phát triển và tiêm chủng"
        rows={[
          ...DEVELOPMENT_ITEMS.filter((i) => !i.ageMonths || e.development[i.key]).map(choiceRow('development', e.development)),
          ...IMMUNIZATION_ITEMS.map(choiceRow('immunization', e.immunization)),
        ]}
      />

      <Section
        title="VI. Khám lâm sàng"
        rows={[
          ...CLINICAL_GROUPS.flatMap((g) => g.items).map(choiceRow('clinical', e.clinical)),
          e.clinical.behaviorNote && row('behaviorNote', 'Ghi rõ', e.clinical.behaviorNote),
        ]}
      />

      <Section
        title="Kết luận và tư vấn"
        rows={[
          row(
            'conclusion',
            c.followUpFinding ? 'So với vấn đề đang theo dõi' : 'Kết luận về sức khỏe',
            conclusionLabelOf(c) || '—',
            'fw-600',
          ),
          c.issueText && row('issueText', 'Ghi rõ', c.issueText),
          c.issueKind && row('issueKind', 'Vấn đề này', ISSUE_KIND_LABELS[c.issueKind]),
          row('action', 'Tư vấn / chuyển khám', conclusionActionLabelOf(c) || '—'),
          c.adviceText && row('adviceText', 'Lời tư vấn', c.adviceText),
          row('doctor', 'Người kết luận', c.doctorName || '—'),
          m.parentContact &&
            row('parentContact', 'Trao đổi phụ huynh', <ParentContact contact={m.parentContact} followUpId={m.followUpId} />),
          c.parentOpinion && row('parentOpinion', 'Ý kiến phụ huynh', c.parentOpinion),
          row(
            'measuredBy',
            'Người nhập phiếu',
            `${m.measuredByName || '—'}${m.concludedAt ? ` · lưu kết luận ${formatDateTime(m.concludedAt)}` : ''}`,
          ),
        ]}
      />
    </div>
  );
}
