import { useId } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardList, Info, Stethoscope } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { FollowUpDueBadge, FollowUpStatusBadge } from '@/components/children/ChildBadges';
import {
  CONCLUSION_ACTION,
  CONCLUSION_ACTION_LABELS,
  CONCLUSION_FLAGS,
  CONCLUSION_MODE,
  FOLLOW_UP_FINDING,
  FOLLOW_UP_FINDING_HINTS,
  FOLLOW_UP_FINDING_LABELS,
  ISSUE_KIND_LABELS,
} from '@/models/children/healthExamForm';
import { FOLLOW_UP_STATUS } from '@/models/children/healthCheckConstants';
import { formatDate } from '@/utils/format';
import { needsParentOpinion } from '@/utils/children/healthExamValidation';
import { ExamCheckGroup, ExamChoiceField, ExamTextField } from './ExamFields';

const ACTION_OPTIONS = Object.values(CONCLUSION_ACTION).map((value) => ({ value, label: CONCLUSION_ACTION_LABELS[value] }));
const FLAG_OPTIONS = CONCLUSION_FLAGS.map((f) => ({ value: f.key, label: f.label }));
const FINDING_OPTIONS = Object.values(FOLLOW_UP_FINDING).map((value) => ({ value, label: FOLLOW_UP_FINDING_LABELS[value] }));
const ISSUE_KIND_OPTIONS = Object.entries(ISSUE_KIND_LABELS).map(([value, label]) => ({ value, label }));
const TB_OPTION = FLAG_OPTIONS.filter((o) => o.value === 'tbRisk');

/** Phiếu theo dõi đang mở của trẻ (BE trả), để bác sĩ thấy trước khi kết luận (user chốt 2026-10-21). */
function OpenFollowUpNotice({ followUp }) {
  const ext = followUp.latestExternalResult;
  return (
    <div className={`alert ${followUp.tbRisk ? 'alert--danger' : 'alert--warning'} mb-16`}>
      <ClipboardList size={18} />
      <div className="tr-cell-stack">
        <div className="row row--wrap gap-2">
          <b>Trẻ đang có phiếu theo dõi từ ngày {formatDate(followUp.openedOn)}</b>
          <FollowUpStatusBadge status={followUp.status} />
          {followUp.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT && (
            <FollowUpDueBadge dueOn={followUp.dueOn} overdueDays={followUp.overdueDays} hideOnTime />
          )}
        </div>
        {followUp.tbRisk && <span>Phiếu có nguy cơ mắc lao (tiền sử tiếp xúc).</span>}
        {followUp.referral && (
          <span>
            Lần khám ngày {formatDate(followUp.referral.date)}: {followUp.referral.issueText || 'không ghi vấn đề'}
            {followUp.referral.specialty ? `. Đề nghị khám chuyên khoa: ${followUp.referral.specialty}` : ''}.
          </span>
        )}
        <span>
          {ext
            ? `Kết quả chuyên khoa gần nhất (${formatDate(ext.on)}${ext.facility ? `, ${ext.facility}` : ''}): ${ext.note}${
                ext.nextVisitOn ? ` Hẹn khám lại ${formatDate(ext.nextVisitOn)}.` : ''
              }`
            : 'Chưa có kết quả khám chuyên khoa.'}
        </span>
        <span className="text-sm">
          Kết luận dưới đây so với vấn đề đang theo dõi. Lưu kết luận không đóng phiếu; giáo viên đóng phiếu khi đã xong việc theo dõi.{' '}
          <Link className="text-primary fw-600" to={`/children/health-follow-ups/${followUp.id}`}>
            Mở phiếu theo dõi
          </Link>
        </span>
      </div>
    </div>
  );
}

/** Các dòng của "Điểm cần bác sĩ xem lại" (BE trả), dùng cho hộp hỏi lại trước khi lưu kết luận. */
export const reviewPointTexts = (points) =>
  points
    ? [
        ...points.vitals.map((p) => p.text),
        ...(points.vitalsHint?.level === 'ALERT' ? [points.vitalsHint.text] : []),
        ...(points.combined.level !== 'NONE' ? [`${points.combined.text}: ${points.combined.signs.join('; ')}`] : []),
        ...points.others.map((p) => p.text),
      ]
    : [];

/** "Điểm cần bác sĩ xem lại" BE trả: sinh tồn theo tuổi (từng chỉ số, gợi ý gộp), gợi ý kết hợp vòng đầu + phát triển, mục khác. */
export function ExamReviewPoints({ points, stale }) {
  if (!points)
    return <p className="muted text-sm m-0">Chuyển qua các bước trước để hệ thống lưu nháp và lập danh sách điểm cần xem lại.</p>;
  const empty = points.vitals.length === 0 && points.combined.level === 'NONE' && points.others.length === 0;
  const vitalsHint = points.vitalsHint;
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
          {vitalsHint && vitalsHint.level !== 'NONE' && (
            <div className={`alert ${vitalsHint.level === 'ALERT' ? 'alert--danger' : 'alert--warning'} tr-alert-flat`}>
              <AlertTriangle size={18} />
              <div>
                <b>{vitalsHint.text}</b> — {vitalsHint.count}/{vitalsHint.total} dấu hiệu sinh tồn ngoài khoảng tham khảo.
              </div>
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

/** Mẫu FOLLOW_UP: một câu so với vấn đề đang theo dõi thay cho 2 nhóm Kết luận, Hướng xử lý (user chốt 2026-10-21). */
function FollowUpConclusionFields({ c, set, setMany, errors, disabled }) {
  const finding = c.followUpFinding;
  const withIssue = finding === FOLLOW_UP_FINDING.ADVICE || finding === FOLLOW_UP_FINDING.NEW_FINDING;
  // Nguy cơ lao tính như bất thường mới ⇒ khóa "Chưa ghi nhận thêm"; tích lao khi đang chọn ô đó thì bỏ chọn (user chốt 2026-10-21).
  const findingOptions = FINDING_OPTIONS.map((o) => (o.value === FOLLOW_UP_FINDING.NO_NEW_FINDING ? { ...o, disabled: c.tbRisk } : o));
  const toggleTb = () =>
    setMany({
      'exam.conclusion.tbRisk': !c.tbRisk,
      ...(!c.tbRisk && finding === FOLLOW_UP_FINDING.NO_NEW_FINDING ? { 'exam.conclusion.followUpFinding': '' } : {}),
    });
  return (
    <>
      <ExamChoiceField
        name="conclusion-follow-up"
        label="So với vấn đề đang theo dõi, bác sĩ kết luận"
        options={findingOptions}
        value={finding}
        onChange={(v) => set('exam.conclusion.followUpFinding', v)}
        error={errors['exam.conclusion.followUpFinding']}
        hint={FOLLOW_UP_FINDING_HINTS[finding]}
        disabled={disabled}
      />
      <div className="mt-12">
        <ExamCheckGroup
          label="Nguy cơ lao"
          options={TB_OPTION}
          values={c.tbRisk ? ['tbRisk'] : []}
          onToggle={toggleTb}
          required={false}
          hint={'Tích ô này thì phiếu theo dõi sang vòng mới như có bất thường mới; không chọn được "Chưa ghi nhận thêm bất thường".'}
          disabled={disabled}
        />
      </div>
      {withIssue && (
        <ExamTextField
          label={finding === FOLLOW_UP_FINDING.ADVICE ? 'Ghi rõ vấn đề bác sĩ ghi nhận' : 'Ghi rõ bất thường mới'}
          required
          multiline
          maxLength={500}
          value={c.issueText}
          onChange={(v) => set('exam.conclusion.issueText', v)}
          error={errors['exam.conclusion.issueText']}
          disabled={disabled}
        />
      )}
      {finding === FOLLOW_UP_FINDING.NEW_FINDING && (
        <div className="mt-12">
          <ExamTextField
            label="Chuyên khoa bác sĩ đề nghị"
            maxLength={150}
            value={c.specialty}
            onChange={(v) => set('exam.conclusion.specialty', v)}
            error={errors['exam.conclusion.specialty']}
            hint="Ghi nếu bác sĩ đề nghị khám chuyên khoa, ví dụ Mắt"
            disabled={disabled}
          />
        </div>
      )}
      {withIssue && (
        <ExamTextField
          label="Lời tư vấn của bác sĩ"
          required={finding === FOLLOW_UP_FINDING.ADVICE}
          multiline
          maxLength={500}
          value={c.adviceText}
          onChange={(v) => set('exam.conclusion.adviceText', v)}
          error={errors['exam.conclusion.adviceText']}
          disabled={disabled}
        />
      )}
    </>
  );
}

/**
 * Mẫu thường (Phụ lục II): Kết luận và Hướng xử lý. Có nguy cơ lao hoặc có vấn đề thì ẩn "Không cần tư vấn hay chuyển khám";
 * câu "Vấn đề này" chỉ hỏi khi trẻ có vấn đề đã biết (knownCondition BE trả) (user chốt 2026-10-21).
 */
function StandardConclusionFields({ c, set, setMany, errors, disabled, knownCondition }) {
  // "Bình thường" không chọn cùng 2 kết luận còn lại: đã tích lao hoặc có vấn đề thì khóa "Bình thường", tích 2 ô này thì tự bỏ "Bình thường" (user chốt 2026-10-21).
  const normalLocked = c.tbRisk || c.healthIssue;
  const flagOptions = FLAG_OPTIONS.map((o) => (o.value === 'normal' ? { ...o, disabled: normalLocked } : o));
  const toggleFlag = (key) => {
    if (key === 'normal')
      setMany({ 'exam.conclusion.normal': !c.normal, 'exam.conclusion.tbRisk': false, 'exam.conclusion.healthIssue': false });
    else
      setMany({
        [`exam.conclusion.${key}`]: !c[key],
        'exam.conclusion.normal': false,
        // Tích lao/có vấn đề khi đang chọn "Không cần…" thì bỏ chọn để bác sĩ chọn lại.
        ...(!c[key] && c.action === CONCLUSION_ACTION.NONE ? { 'exam.conclusion.action': '' } : {}),
      });
  };
  const needsAction = c.tbRisk || c.healthIssue;
  const actionOptions = needsAction ? ACTION_OPTIONS.filter((o) => o.value !== CONCLUSION_ACTION.NONE) : ACTION_OPTIONS;
  const flags = CONCLUSION_FLAGS.filter((f) => c[f.key]).map((f) => f.key);
  const asksKind = !!knownCondition && c.healthIssue && !c.tbRisk && c.action !== CONCLUSION_ACTION.REFERRAL;
  return (
    <>
      <ExamCheckGroup
        label="Kết luận về sức khỏe"
        options={flagOptions}
        values={flags}
        onToggle={toggleFlag}
        error={errors['exam.conclusion.flags']}
        hint={normalLocked ? 'Bỏ tích "Có nguy cơ mắc lao" và "Có vấn đề về sức khỏe" để chọn "Bình thường".' : undefined}
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
          options={actionOptions}
          value={c.action}
          onChange={(v) => set('exam.conclusion.action', v)}
          error={errors['exam.conclusion.action']}
          hint={needsAction ? 'Có nguy cơ lao hoặc có vấn đề sức khỏe: chọn Tư vấn hoặc Chuyển khám chuyên khoa.' : undefined}
          disabled={disabled}
        />
      </div>
      {asksKind && (
        <div className="mt-12">
          <ExamChoiceField
            name="conclusion-issue-kind"
            label="Vấn đề này"
            options={ISSUE_KIND_OPTIONS}
            value={c.issueKind}
            onChange={(v) => set('exam.conclusion.issueKind', v)}
            error={errors['exam.conclusion.issueKind']}
            hint={`Trẻ có vấn đề đã biết: ${knownCondition}. Vấn đề lần này là vấn đề đó và không thay đổi thì trẻ không mang nhãn Cần theo dõi.`}
            disabled={disabled}
          />
        </div>
      )}
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
      </div>
    </>
  );
}

/**
 * Bước 5 — Kết luận và tư vấn: nhập đúng lời bác sĩ. Mức theo dõi theo kết luận này (user chốt 2026-10-17).
 * mode do BE chọn (CONCLUSION_MODE); openFollowUp: phiếu theo dõi đang mở của trẻ; knownCondition: vấn đề đã biết (BE trả).
 */
export function ExamConclusionStep({
  form,
  set,
  setMany,
  errors,
  reviewPoints,
  reviewStale,
  doctorNames,
  requireReason,
  disabled,
  mode,
  openFollowUp,
  knownCondition,
}) {
  const c = form.exam.conclusion;
  const listId = useId();
  const fieldProps = { c, set, setMany, errors, disabled };

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
        {openFollowUp && <OpenFollowUpNotice followUp={openFollowUp} />}
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>Ghi đúng lời bác sĩ đã kết luận và đã nói với người đi cùng trẻ. Hệ thống không tự kết luận.</div>
        </div>
        {mode === CONCLUSION_MODE.FOLLOW_UP ? (
          <FollowUpConclusionFields {...fieldProps} />
        ) : (
          <StandardConclusionFields {...fieldProps} knownCondition={knownCondition} />
        )}
        <div className="grid-2 mt-12">
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
        {needsParentOpinion(form.exam, mode) && (
          <div className="mt-12">
            <ExamTextField
              label="Ý kiến phụ huynh"
              required
              multiline
              maxLength={500}
              value={c.parentOpinion}
              onChange={(v) => set('exam.conclusion.parentOpinion', v)}
              error={errors['exam.conclusion.parentOpinion']}
              hint={`Kết quả ở mức Cần theo dõi sát: ghi ý kiến của ${form.exam.admin.companion?.fullName || 'người đi cùng'} sau khi nghe bác sĩ, ví dụ đồng ý đưa trẻ đi khám chuyên khoa. Ghi vào lần trao đổi tại buổi khám của phiếu theo dõi.`}
              disabled={disabled}
            />
          </div>
        )}
        {requireReason && (
          <ExamTextField
            label="Lý do sửa phiếu đã có kết luận"
            required
            multiline
            maxLength={300}
            value={form.reason}
            onChange={(v) => set('reason', v)}
            error={errors.reason}
            hint="Lịch sử sửa lưu người sửa, thời điểm, giá trị cũ và mới."
            disabled={disabled}
          />
        )}
      </section>
    </>
  );
}
