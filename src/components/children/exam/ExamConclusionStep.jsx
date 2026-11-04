import { Fragment, useId } from 'react';
import { AlertTriangle, CheckCircle2, Info, Stethoscope } from '@/components/ui/icons';
import {
  CONCLUSION_ACTION,
  CONCLUSION_ACTION_LABELS,
  CONCLUSION_FLAGS,
  CONCLUSION_MODE,
  EXAM_STEPS,
  FOLLOW_UP_FINDING,
  FOLLOW_UP_FINDING_HINTS,
  FOLLOW_UP_FINDING_LABELS,
} from '@/models/children/healthExamForm';
import { needsParentOpinion } from '@/utils/children/healthExamValidation';
import {
  EXAM_SECTIONS,
  ExamSheetBand,
  ExamSheetCard,
  ExamSheetChecksCell,
  ExamSheetChoiceCell,
  ExamSheetInputCell,
  ExamSheetRows,
  ExamSheetTable,
} from './ExamFields';

const ACTION_OPTIONS = Object.values(CONCLUSION_ACTION).map((value) => ({ value, label: CONCLUSION_ACTION_LABELS[value] }));
const FLAG_OPTIONS = CONCLUSION_FLAGS.map((f) => ({ value: f.key, label: f.label }));
const FINDING_OPTIONS = Object.values(FOLLOW_UP_FINDING).map((value) => ({ value, label: FOLLOW_UP_FINDING_LABELS[value] }));
const TB_OPTION = FLAG_OPTIONS.filter((o) => o.value === 'tbRisk');

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

// Cả khối đã là gợi ý nên bỏ tiền tố "Gợi ý:" của câu BE trả, viết hoa chữ đầu.
const hintTitle = (text) => {
  const t = String(text || '').replace(/^Gợi ý:\s*/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// Câu "Nhãn: giá trị" BE trả tách thành cặp nhãn – giá trị; câu không có dấu hai chấm giữ nguyên làm giá trị.
const labelValueOf = (text) => {
  const i = text.indexOf(': ');
  return i > 0 ? [text.slice(0, i), text.slice(i + 2)] : ['', text];
};

/** Một gợi ý gộp: tiêu đề ngắn, số dấu hiệu, mỗi dấu hiệu một dòng (mức mạnh tông đỏ, còn lại tông cam). */
function ReviewHint({ strong, title, summary, signs = [] }) {
  return (
    <div className={`alert ${strong ? 'alert--danger' : 'alert--warning'} tr-alert-flat`}>
      <AlertTriangle size={18} />
      <div className="tr-review__hint">
        <span className="fw-600">{hintTitle(title)}</span>
        <span className="text-sm">{summary}</span>
        {signs.length > 0 && (
          <ul className="tr-review__signs text-sm">
            {signs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Mục đã ghi dạng nhãn – giá trị (nhãn mờ, giá trị chữ chính); câu không có nhãn chiếm cả dòng. */
function ReviewItems({ title, items }) {
  return (
    <section>
      <h3 className="subsection-title">{title}</h3>
      <dl className="info-list tr-review__items">
        {items.map(({ key, text }) => {
          const [label, value] = labelValueOf(text);
          return label ? (
            <Fragment key={key}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ) : (
            <dd key={key} className="tr-review__full">
              {value}
            </dd>
          );
        })}
      </dl>
    </section>
  );
}

/** "Điểm cần bác sĩ xem lại" BE trả: gợi ý gộp (sinh tồn, vòng đầu + phát triển) lên đầu, rồi từng chỉ số sinh tồn, mục khác. */
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
          {points.combined.level !== 'NONE' && (
            <ReviewHint
              strong={points.combined.level === 'REFERRAL'}
              title={points.combined.text}
              summary={`${points.combined.signs.length}/${points.combined.total} dấu hiệu vòng đầu và phát triển`}
              signs={points.combined.signs}
            />
          )}
          {vitalsHint && vitalsHint.level !== 'NONE' && (
            <ReviewHint
              strong={vitalsHint.level === 'ALERT'}
              title={vitalsHint.text}
              summary={`${vitalsHint.count}/${vitalsHint.total} dấu hiệu sinh tồn ngoài khoảng tham khảo`}
            />
          )}
          {points.vitals.length > 0 && (
            <ReviewItems title="Sinh tồn ngoài khoảng tham khảo" items={points.vitals.map((p) => ({ key: p.key, text: p.text }))} />
          )}
          {points.others.length > 0 && (
            <ReviewItems title="Các mục khác đã ghi" items={points.others.map((p) => ({ key: p.text, text: p.text }))} />
          )}
        </>
      )}
      <p className="row gap-1-5 muted text-xs m-0">
        <Info size={14} />
        <span>
          Gợi ý để bác sĩ xem lại, không phải kết luận. Ngưỡng: {points.reference}.{stale ? ' Danh sách theo lần lưu gần nhất.' : ''}
        </span>
      </p>
    </div>
  );
}

/** Card "Điểm cần bác sĩ xem lại" (bước Kết luận và trang xem phiếu). */
export function ExamReviewCard({ points, stale }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          <Stethoscope size={18} className="text-primary" />
          Điểm cần bác sĩ xem lại
        </h2>
      </div>
      <div className="card__body">
        <ExamReviewPoints points={points} stale={stale} />
      </div>
    </section>
  );
}

/**
 * Mẫu FOLLOW_UP, chỉ còn ở phiếu đã kết luận khi trẻ có phiếu theo dõi (trước 2026-11-04): sửa phiếu giữ mẫu này. Một câu so với vấn
 * đề đang theo dõi thay cho 2 nhóm Kết luận, Hướng xử lý (user chốt 2026-10-21). Trả về các dòng của bảng phiếu.
 */
const followUpConclusionRows = ({ c, set, setMany, errors, disabled, id }) => {
  const finding = c.followUpFinding;
  const withIssue = finding === FOLLOW_UP_FINDING.ADVICE || finding === FOLLOW_UP_FINDING.NEW_FINDING;
  // Nguy cơ lao tính như bất thường mới ⇒ khóa "Chưa ghi nhận thêm"; tích lao khi đang chọn ô đó thì bỏ chọn (user chốt 2026-10-21).
  const findingOptions = FINDING_OPTIONS.map((o) => (o.value === FOLLOW_UP_FINDING.NO_NEW_FINDING ? { ...o, disabled: c.tbRisk } : o));
  const toggleTb = () =>
    setMany({
      'exam.conclusion.tbRisk': !c.tbRisk,
      ...(!c.tbRisk && finding === FOLLOW_UP_FINDING.NO_NEW_FINDING ? { 'exam.conclusion.followUpFinding': '' } : {}),
    });
  return [
    {
      key: 'finding',
      label: 'So với vấn đề đang theo dõi, bác sĩ kết luận',
      id: id('finding'),
      required: true,
      cell: (
        <ExamSheetChoiceCell
          name="conclusion-follow-up"
          labelledBy={id('finding')}
          options={findingOptions}
          value={finding}
          onChange={(v) => set('exam.conclusion.followUpFinding', v)}
          error={errors['exam.conclusion.followUpFinding']}
          hint={FOLLOW_UP_FINDING_HINTS[finding]}
          disabled={disabled}
        />
      ),
    },
    {
      key: 'tb',
      label: 'Nguy cơ lao',
      id: id('tb'),
      cell: (
        <ExamSheetChecksCell
          labelledBy={id('tb')}
          options={TB_OPTION}
          values={c.tbRisk ? ['tbRisk'] : []}
          onToggle={toggleTb}
          hint={'Tích ô này thì không chọn được "Chưa ghi nhận thêm bất thường".'}
          disabled={disabled}
        />
      ),
    },
    withIssue && {
      key: 'issue',
      label: finding === FOLLOW_UP_FINDING.ADVICE ? 'Ghi rõ vấn đề bác sĩ ghi nhận' : 'Ghi rõ bất thường mới',
      id: id('issue'),
      required: true,
      cell: (
        <ExamSheetInputCell
          multiline
          maxLength={500}
          labelledBy={id('issue')}
          value={c.issueText}
          onChange={(v) => set('exam.conclusion.issueText', v)}
          error={errors['exam.conclusion.issueText']}
          disabled={disabled}
        />
      ),
    },
    finding === FOLLOW_UP_FINDING.NEW_FINDING && {
      key: 'specialty',
      label: 'Chuyên khoa bác sĩ đề nghị',
      id: id('specialty'),
      cell: (
        <ExamSheetInputCell
          size="short"
          maxLength={150}
          labelledBy={id('specialty')}
          value={c.specialty}
          onChange={(v) => set('exam.conclusion.specialty', v)}
          error={errors['exam.conclusion.specialty']}
          hint="Ghi nếu bác sĩ đề nghị khám chuyên khoa, ví dụ Mắt"
          disabled={disabled}
        />
      ),
    },
    withIssue && {
      key: 'advice',
      label: 'Lời tư vấn của bác sĩ',
      id: id('advice'),
      required: finding === FOLLOW_UP_FINDING.ADVICE,
      cell: (
        <ExamSheetInputCell
          multiline
          maxLength={500}
          labelledBy={id('advice')}
          value={c.adviceText}
          onChange={(v) => set('exam.conclusion.adviceText', v)}
          error={errors['exam.conclusion.adviceText']}
          disabled={disabled}
        />
      ),
    },
  ];
};

/**
 * Mẫu thường (Phụ lục II): Kết luận và Hướng xử lý. Có nguy cơ lao hoặc có vấn đề thì ẩn "Không cần tư vấn hay chuyển khám".
 * Không còn câu "Vấn đề này" (mới hay đã biết) — user bỏ 2026-11-04. Trả về các dòng của bảng phiếu.
 */
const standardConclusionRows = ({ c, set, setMany, errors, disabled, id }) => {
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
  return [
    {
      key: 'flags',
      label: 'Kết luận về sức khỏe',
      id: id('flags'),
      required: true,
      cell: (
        <ExamSheetChecksCell
          labelledBy={id('flags')}
          options={flagOptions}
          values={flags}
          onToggle={toggleFlag}
          error={errors['exam.conclusion.flags']}
          hint={normalLocked ? 'Bỏ tích "Có nguy cơ mắc lao" và "Có vấn đề về sức khỏe" để chọn "Bình thường".' : undefined}
          disabled={disabled}
        />
      ),
    },
    c.healthIssue && {
      key: 'issue',
      label: 'Ghi rõ vấn đề sức khỏe',
      id: id('issue'),
      required: true,
      cell: (
        <ExamSheetInputCell
          multiline
          maxLength={500}
          labelledBy={id('issue')}
          value={c.issueText}
          onChange={(v) => set('exam.conclusion.issueText', v)}
          error={errors['exam.conclusion.issueText']}
          disabled={disabled}
        />
      ),
    },
    {
      key: 'action',
      label: 'Cần được tư vấn/chuyển khám chuyên khoa',
      id: id('action'),
      required: true,
      cell: (
        <ExamSheetChoiceCell
          name="conclusion-action"
          labelledBy={id('action')}
          options={actionOptions}
          value={c.action}
          onChange={(v) => set('exam.conclusion.action', v)}
          error={errors['exam.conclusion.action']}
          hint={needsAction ? 'Có nguy cơ lao hoặc có vấn đề sức khỏe: chọn Tư vấn hoặc Chuyển khám chuyên khoa.' : undefined}
          disabled={disabled}
        />
      ),
    },
    c.action === CONCLUSION_ACTION.REFERRAL && {
      key: 'specialty',
      label: 'Chuyên khoa bác sĩ đề nghị',
      id: id('specialty'),
      required: true,
      cell: (
        <ExamSheetInputCell
          size="short"
          maxLength={150}
          labelledBy={id('specialty')}
          value={c.specialty}
          onChange={(v) => set('exam.conclusion.specialty', v)}
          error={errors['exam.conclusion.specialty']}
          hint="Ví dụ: Mắt, Tai mũi họng, Nhi khoa – khám phát triển"
          disabled={disabled}
        />
      ),
    },
    (c.action === CONCLUSION_ACTION.ADVICE || c.action === CONCLUSION_ACTION.REFERRAL) && {
      key: 'advice',
      label: 'Lời tư vấn của bác sĩ',
      id: id('advice'),
      required: c.action === CONCLUSION_ACTION.ADVICE,
      cell: (
        <ExamSheetInputCell
          multiline
          maxLength={500}
          labelledBy={id('advice')}
          value={c.adviceText}
          onChange={(v) => set('exam.conclusion.adviceText', v)}
          error={errors['exam.conclusion.adviceText']}
          disabled={disabled}
        />
      ),
    },
  ];
};

/**
 * Bước 5 — Kết luận và tư vấn: nhập đúng lời bác sĩ. Mức theo dõi theo kết luận này (user chốt 2026-10-17).
 * mode do BE chọn (CONCLUSION_MODE: FOLLOW_UP chỉ ở phiếu cũ).
 */
export function ExamConclusionStep({ form, set, setMany, errors, reviewPoints, reviewStale, doctorNames, requireReason, disabled, mode }) {
  const c = form.exam.conclusion;
  const uid = useId();
  const id = (key) => `${uid}-${key}`;
  const fieldProps = { c, set, setMany, errors, disabled, id };
  const rows = [
    ...(mode === CONCLUSION_MODE.FOLLOW_UP ? followUpConclusionRows(fieldProps) : standardConclusionRows(fieldProps)),
    {
      key: 'doctor',
      label: 'Bác sĩ kết luận',
      id: id('doctor'),
      required: true,
      cell: (
        <ExamSheetInputCell
          size="short"
          list={id('doctors')}
          maxLength={100}
          labelledBy={id('doctor')}
          value={c.doctorName}
          onChange={(v) => set('exam.conclusion.doctorName', v)}
          error={errors['exam.conclusion.doctorName']}
          hint="Họ tên bác sĩ ký phiếu"
          disabled={disabled}
        >
          <datalist id={id('doctors')}>
            {doctorNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </ExamSheetInputCell>
      ),
    },
    needsParentOpinion(form.exam, mode) && {
      key: 'parent',
      label: 'Ý kiến phụ huynh',
      id: id('parent'),
      required: true,
      cell: (
        <ExamSheetInputCell
          multiline
          maxLength={500}
          labelledBy={id('parent')}
          value={c.parentOpinion}
          onChange={(v) => set('exam.conclusion.parentOpinion', v)}
          error={errors['exam.conclusion.parentOpinion']}
          hint={`Kết quả ở mức Cần theo dõi sát: ghi ý kiến của ${form.exam.admin.companion?.fullName || 'người đi cùng'} sau khi nghe bác sĩ, ví dụ đồng ý đưa trẻ đi khám chuyên khoa.`}
          disabled={disabled}
        />
      ),
    },
    requireReason && {
      key: 'reason',
      label: 'Lý do sửa phiếu đã có kết luận',
      id: id('reason'),
      required: true,
      cell: (
        <ExamSheetInputCell
          multiline
          maxLength={300}
          labelledBy={id('reason')}
          value={form.reason}
          onChange={(v) => set('reason', v)}
          error={errors.reason}
          hint="Lịch sử sửa lưu người sửa, thời điểm, giá trị cũ và mới."
          disabled={disabled}
        />
      ),
    },
  ];

  return (
    <>
      <ExamReviewCard points={reviewPoints} stale={reviewStale} />
      <ExamSheetCard
        title={EXAM_STEPS[4].label}
        info={
          <>
            Ghi đúng lời bác sĩ đã kết luận và đã nói với người đi cùng trẻ. Hệ thống không tự kết luận.
            {mode === CONCLUSION_MODE.FOLLOW_UP &&
              ' Phiếu này đã kết luận theo mẫu cũ (so với vấn đề đang theo dõi), sửa phiếu vẫn giữ mẫu đó.'}
          </>
        }
      >
        <ExamSheetTable label={EXAM_SECTIONS.conclusion}>
          <ExamSheetBand primary>{EXAM_SECTIONS.conclusion}</ExamSheetBand>
          <ExamSheetRows rows={rows} />
        </ExamSheetTable>
      </ExamSheetCard>
    </>
  );
}
