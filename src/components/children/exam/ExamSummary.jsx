import { GENDER_LABELS } from '@/models/School';
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

const isBlank = (v) => v === '' || v == null;
const show = (v, unit = '') => (isBlank(v) ? <span className="muted">—</span> : `${typeof v === 'number' ? formatDecimal(v) : v}${unit}`);
const yesNo = (v) => (v === YES_NO.YES ? 'Có' : v === YES_NO.NO ? 'Không' : null);

/** Giá trị một câu theo lựa chọn của mẫu; lựa chọn bất thường hiện dạng chip cảnh báo. */
function Choice({ options, value }) {
  const o = options.find((x) => x.value === value);
  if (!o) return <span className="muted">—</span>;
  return o.abnormal ? <span className="chip chip--orange">{o.label}</span> : o.label;
}

function Section({ title, children }) {
  return (
    <section className="tr-exam-section">
      <h3 className="subsection-title">{title}</h3>
      <dl className="info-list">{children}</dl>
    </section>
  );
}

/** Phiếu Phụ lục II chỉ đọc (đã kết luận, hoặc người xem không nhập được). CCCD chỉ hiện ở đây. */
export function ExamSummary({ measurement: m, child, campaign }) {
  const e = m.exam;
  const a = e.admin;
  const c = e.conclusion;
  return (
    <div className="tr-exam-summary">
      <Section title="I. Thông tin hành chính">
        <dt>Họ và tên</dt>
        <dd className="fw-600">{child.fullName.toUpperCase()}</dd>
        <dt>Số CC/CCCD/Hộ chiếu/Mã định danh</dt>
        <dd>{show(a.childIdNumber)}</dd>
        <dt>Ngày sinh · Giới</dt>
        <dd>
          {formatDate(child.dateOfBirth)} · {GENDER_LABELS[child.gender] || child.gender}
        </dd>
        <dt>Sinh non · Tuần thai khi sinh</dt>
        <dd>
          {yesNo(a.premature) || '—'} · {show(a.gestationWeeks, ' tuần')}
        </dd>
        <dt>Dân tộc · Đối tượng</dt>
        <dd>
          {show(a.ethnicity)} · {show(a.beneficiary)}
        </dd>
        <dt>Nguồn chi trả · Nhóm máu</dt>
        <dd>
          {show(a.paymentSource)} · {show(a.bloodType)}
        </dd>
        <dt>Nơi ở hiện tại</dt>
        <dd>{show([a.address.street, a.address.ward, a.address.province].filter(Boolean).join(', '))}</dd>
        <dt>Cơ sở giáo dục</dt>
        <dd>
          {child.schoolName} · {child.className}
        </dd>
        <dt>Người đi cùng trẻ</dt>
        <dd>
          {a.hasCompanion === YES_NO.YES ? (
            <>
              {a.companion.fullName} ({a.companion.relation}){a.companion.phone ? ` · ${a.companion.phone}` : ''}
              {a.companion.idNumber ? ` · CCCD ${a.companion.idNumber}` : ''}
            </>
          ) : (
            'Không có người đi cùng'
          )}
        </dd>
        <dt>Ngày · Cơ sở kiểm tra sức khỏe</dt>
        <dd>
          {formatDate(m.date)} · {campaign.examiner || '—'}
        </dd>
        {HISTORY_ITEMS.map((i) => (
          <div key={i.key} className="tr-dl-pair">
            <dt>{i.label}</dt>
            <dd>
              <Choice options={i.options} value={e.history[i.key]} />
              {i.textKey && e.history[i.textKey] ? ` — ${e.history[i.textKey]}` : ''}
              {i.dateKey && e.history[i.dateKey] ? ` — gần nhất ngày ${formatDate(e.history[i.dateKey])}` : ''}
            </dd>
          </div>
        ))}
      </Section>

      <Section title="II. Dấu hiệu sinh tồn">
        {VITAL_ITEMS.map((i) => (
          <div key={i.key} className="tr-dl-pair">
            <dt>{i.label}</dt>
            <dd>
              {show(e.vitals[i.key])} · <Choice options={i.options} value={e.vitals[i.statusKey]} />
            </dd>
          </div>
        ))}
      </Section>

      <Section title="III. Dinh dưỡng">
        <dt>Chiều cao/chiều dài · Chiều dài/Tuổi</dt>
        <dd>
          {show(m.heightCm, ' cm')} · {show(e.nutrition.lengthForAgeSd, ' SD')}
        </dd>
        <dt>Cân nặng · Cân nặng/Tuổi</dt>
        <dd>
          {show(m.weightKg, ' kg')} · {show(e.nutrition.weightForAgeSd, ' SD')}
        </dd>
        <dt>Vòng đầu</dt>
        <dd>
          {m.headCircumferenceCm == null ? (
            <span className="muted">Không đo</span>
          ) : (
            <>
              {show(m.headCircumferenceCm, ' cm')} · <Choice options={HEAD_STATUS_OPTIONS} value={e.nutrition.headStatus} />
            </>
          )}
        </dd>
        <dt>Chu vi vòng cánh tay</dt>
        <dd>{show(e.nutrition.armCircumferenceMm, ' mm')}</dd>
        <dt>BMI (hệ thống tính)</dt>
        <dd>{show(m.bmi)}</dd>
        <dt>Tình trạng dinh dưỡng</dt>
        <dd className="row row--wrap gap-2">
          {e.nutrition.statuses.length === 0 ? (
            <span className="muted">—</span>
          ) : (
            e.nutrition.statuses.map((s) => <Choice key={s} options={NUTRITION_STATUS_OPTIONS} value={s} />)
          )}
        </dd>
      </Section>

      <Section title="IV–V. Phát triển và tiêm chủng">
        {DEVELOPMENT_ITEMS.filter((i) => !i.ageMonths || e.development[i.key]).map((i) => (
          <div key={i.key} className="tr-dl-pair">
            <dt>{i.label}</dt>
            <dd>
              <Choice options={i.options} value={e.development[i.key]} />
            </dd>
          </div>
        ))}
        {IMMUNIZATION_ITEMS.map((i) => (
          <div key={i.key} className="tr-dl-pair">
            <dt>Tiêm chủng — {i.label}</dt>
            <dd>
              <Choice options={i.options} value={e.immunization[i.key]} />
            </dd>
          </div>
        ))}
      </Section>

      <Section title="VI. Khám lâm sàng">
        {CLINICAL_GROUPS.flatMap((g) => g.items).map((i) => (
          <div key={i.key} className="tr-dl-pair">
            <dt>{i.label}</dt>
            <dd>
              <Choice options={i.options} value={e.clinical[i.key]} />
            </dd>
          </div>
        ))}
        {e.clinical.behaviorNote && (
          <>
            <dt>Ghi rõ</dt>
            <dd>{e.clinical.behaviorNote}</dd>
          </>
        )}
      </Section>

      <Section title="Kết luận và tư vấn">
        <dt>{c.followUpFinding ? 'So với vấn đề đang theo dõi' : 'Kết luận về sức khỏe'}</dt>
        <dd className="fw-600">{conclusionLabelOf(c) || '—'}</dd>
        {c.issueText && (
          <>
            <dt>Ghi rõ</dt>
            <dd>{c.issueText}</dd>
          </>
        )}
        {c.issueKind && (
          <>
            <dt>Vấn đề này</dt>
            <dd>{ISSUE_KIND_LABELS[c.issueKind]}</dd>
          </>
        )}
        <dt>Tư vấn / chuyển khám</dt>
        <dd>{conclusionActionLabelOf(c) || '—'}</dd>
        {c.adviceText && (
          <>
            <dt>Lời tư vấn</dt>
            <dd>{c.adviceText}</dd>
          </>
        )}
        <dt>Người kết luận</dt>
        <dd>{c.doctorName || '—'}</dd>
        <dt>Người nhập phiếu</dt>
        <dd>
          {m.measuredByName || '—'}
          {m.concludedAt ? ` · lưu kết luận ${formatDateTime(m.concludedAt)}` : ''}
        </dd>
      </Section>
    </div>
  );
}
