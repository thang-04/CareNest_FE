import { useId } from 'react';
import { AlertTriangle, CheckCircle2, Info, Stethoscope } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { CONCLUSION_ACTION, CONCLUSION_ACTION_LABELS, CONCLUSION_FLAGS } from '@/models/children/healthExamForm';
import { ExamCheckGroup, ExamChoiceField, ExamTextField } from './ExamFields';

const ACTION_OPTIONS = Object.values(CONCLUSION_ACTION).map((value) => ({ value, label: CONCLUSION_ACTION_LABELS[value] }));
const FLAG_OPTIONS = CONCLUSION_FLAGS.map((f) => ({ value: f.key, label: f.label }));

/** "Điểm cần bác sĩ xem lại" BE trả: sinh tồn theo tuổi, gợi ý kết hợp vòng đầu + phát triển, các mục khác. Chỉ là gợi ý. */
export function ExamReviewPoints({ points, stale }) {
  if (!points)
    return <p className="muted text-sm m-0">Chuyển qua các bước trước để hệ thống lưu nháp và lập danh sách điểm cần xem lại.</p>;
  const empty = points.vitals.length === 0 && points.combined.level === 'NONE' && points.others.length === 0;
  return (
    <div className="tr-review">
      {empty ? (
        <div className="row gap-2">
          <CheckCircle2 size={18} className="text-success" />
          <span>Không có mục nào được ghi bất thường.</span>
        </div>
      ) : (
        <>
          {points.vitals.length > 0 && (
            <div>
              <h3 className="subsection-title">Dấu hiệu sinh tồn ngoài khoảng tham khảo</h3>
              <ul className="tr-review__list">
                {points.vitals.map((p) => (
                  <li key={p.key}>{p.text}</li>
                ))}
              </ul>
            </div>
          )}
          {points.combined.level !== 'NONE' && (
            <div className={`alert ${points.combined.level === 'REFERRAL' ? 'alert--danger' : 'alert--warning'} tr-alert-flat`}>
              <AlertTriangle size={18} />
              <div>
                <b>{points.combined.text}</b> — {points.combined.signs.length}/{points.combined.total} dấu hiệu vòng đầu và phát triển:{' '}
                {points.combined.signs.join('; ')}.
              </div>
            </div>
          )}
          {points.others.length > 0 && (
            <div>
              <h3 className="subsection-title">Các mục khác đã ghi</h3>
              <ul className="tr-review__list">
                {points.others.map((p) => (
                  <li key={p.text}>{p.text}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <p className="muted text-xs m-0">
        Gợi ý để bác sĩ xem lại, không phải kết luận. Ngưỡng: {points.reference}.{stale ? ' Danh sách theo lần lưu gần nhất.' : ''}
      </p>
    </div>
  );
}

/** Bước 5 — Kết luận và tư vấn: nhập đúng lời bác sĩ. Mức theo dõi theo kết luận này (user chốt 2026-10-17). */
export function ExamConclusionStep({ form, set, setMany, errors, reviewPoints, reviewStale, doctorNames, requireReason, disabled }) {
  const c = form.exam.conclusion;
  const listId = useId();
  // "Bình thường" không chọn cùng 2 kết luận còn lại.
  const toggleFlag = (key) => {
    if (key === 'normal')
      setMany({ 'exam.conclusion.normal': !c.normal, 'exam.conclusion.tbRisk': false, 'exam.conclusion.healthIssue': false });
    else setMany({ [`exam.conclusion.${key}`]: !c[key], 'exam.conclusion.normal': false });
  };
  const flags = CONCLUSION_FLAGS.filter((f) => c[f.key]).map((f) => f.key);

  return (
    <>
      <section className="card wizard-card">
        <div className="row gap-2 mb-12">
          <Stethoscope size={18} className="text-primary" />
          <h2 className="card__title">Điểm cần bác sĩ xem lại</h2>
        </div>
        <ExamReviewPoints points={reviewPoints} stale={reviewStale} />
      </section>

      <section className="card wizard-card mt-16">
        <h2 className="card__title mb-12">Kết luận và tư vấn</h2>
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>Ghi đúng lời bác sĩ đã kết luận và đã nói với người đi cùng trẻ. Hệ thống không tự kết luận.</div>
        </div>
        <ExamCheckGroup
          label="Kết luận về sức khỏe"
          options={FLAG_OPTIONS}
          values={flags}
          onToggle={toggleFlag}
          error={errors['exam.conclusion.flags']}
          disabled={disabled}
        />
        {c.healthIssue && (
          <ExamTextField
            label="Ghi rõ vấn đề sức khỏe"
            required
            multiline
            maxLength={500}
            value={c.issueText}
            onChange={(v) => set('exam.conclusion.issueText', v)}
            error={errors['exam.conclusion.issueText']}
            disabled={disabled}
          />
        )}
        <div className="mt-12">
          <ExamChoiceField
            name="conclusion-action"
            label="Cần được tư vấn/chuyển khám chuyên khoa"
            options={ACTION_OPTIONS}
            value={c.action}
            onChange={(v) => set('exam.conclusion.action', v)}
            error={errors['exam.conclusion.action']}
            disabled={disabled}
          />
        </div>
        <div className="grid-2 mt-12">
          {c.action === CONCLUSION_ACTION.REFERRAL && (
            <ExamTextField
              label="Chuyên khoa bác sĩ đề nghị"
              required
              maxLength={150}
              value={c.specialty}
              onChange={(v) => set('exam.conclusion.specialty', v)}
              error={errors['exam.conclusion.specialty']}
              hint="Ví dụ: Mắt, Tai mũi họng, Nhi khoa – khám phát triển"
              disabled={disabled}
            />
          )}
          {(c.action === CONCLUSION_ACTION.ADVICE || c.action === CONCLUSION_ACTION.REFERRAL) && (
            <ExamTextField
              label="Lời tư vấn của bác sĩ"
              required={c.action === CONCLUSION_ACTION.ADVICE}
              multiline
              maxLength={500}
              value={c.adviceText}
              onChange={(v) => set('exam.conclusion.adviceText', v)}
              error={errors['exam.conclusion.adviceText']}
              disabled={disabled}
            />
          )}
          <FormField label="Bác sĩ kết luận" required error={errors['exam.conclusion.doctorName']} hint="Họ tên bác sĩ ký phiếu">
            <input
              className="input"
              list={listId}
              maxLength={100}
              value={c.doctorName}
              disabled={disabled}
              onChange={(e) => set('exam.conclusion.doctorName', e.target.value)}
            />
          </FormField>
          <datalist id={listId}>
            {doctorNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        {requireReason && (
          <ExamTextField
            label="Lý do sửa phiếu đã có kết luận"
            required
            multiline
            maxLength={300}
            value={form.reason}
            onChange={(v) => set('reason', v)}
            error={errors.reason}
            hint="Lịch sử sửa lưu người sửa, thời điểm, giá trị cũ và mới. Phiếu đã công bố cần công bố lại."
            disabled={disabled}
          />
        )}
      </section>
    </>
  );
}
