import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CircleCheck, CircleX, Send } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import {
  Card,
  EduStatusBadge,
  EmptyState,
  Field,
  History,
  Modal,
  Notice,
  PageHead,
  SignatureBox,
  SignatureView,
} from '@/components/education-plan/eduUi';
import { LessonBody, className, typeLabel } from '@/components/education-plan/lessonShared';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ThemeBody } from '@/pages/education-plan/ThemeDetailPage';

/**
 * Screen 48 (team leader reviews a lesson plan) and screen 49 (vice principal approves a theme plan / lesson plan).
 * stage = 'tl' | 'vp'
 */
export default function PlanReviewPage({ stage }) {
  const params = useParams();
  const kind = stage === 'tl' ? 'giao-an' : params.kind;
  const { themes, lessons, goals, user, saveTheme, saveLesson, toast, historyEntry } = useEducationPlan();
  const navigate = useNavigate();
  const [decision, setDecision] = useState('');
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);

  const isTheme = kind === 'chu-de';
  const item = isTheme ? themes.find((t) => t.id === params.id) : lessons.find((l) => l.id === params.id);
  const backTo = stage === 'tl' ? '/education/reviews' : '/education/approvals';
  const backLabel = stage === 'tl' ? 'Duyệt giáo án' : 'Phê duyệt kế hoạch';

  if (!item)
    return (
      <div className="page">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: backLabel, to: backTo }]} title="Không tìm thấy kế hoạch" />
        <Card>
          <EmptyState
            title="Không tìm thấy kế hoạch"
            action={
              <Link className="btn" to={backTo}>
                Về danh sách
              </Link>
            }
          />
        </Card>
      </div>
    );

  const expected = stage === 'tl' ? EDU_STATUS.PENDING_TL : EDU_STATUS.PENDING_VP;
  const theme = isTheme ? item : themes.find((t) => t.id === item.themeId);
  const goal = goals.find((g) => g.id === theme?.goalId);
  const title = isTheme ? `Kế hoạch chủ đề: ${item.name}` : `${typeLabel(item.type)} lớp ${className(item.classId)}`;

  const validate = () => {
    const e = {};
    if (!decision) e.decision = 'Chọn phê duyệt hoặc từ chối';
    if (decision === 'reject' && !comment.trim()) e.comment = 'Nhập lý do từ chối để người lập biết cần sửa gì';
    if (decision === 'approve' && !signature) e.signature = 'Ký xác nhận trước khi phê duyệt';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const apply = () => {
    const approve = decision === 'approve';
    const action = approve
      ? stage === 'tl'
        ? 'Tổ trưởng duyệt, chuyển Phó HT'
        : 'Phó HT phê duyệt'
      : stage === 'tl'
        ? 'Tổ trưởng từ chối'
        : 'Phó HT từ chối';
    const entry = historyEntry(action, { tone: approve ? 'ok' : 'err', note: comment.trim() || undefined });
    const status = approve ? (stage === 'tl' ? EDU_STATUS.PENDING_VP : EDU_STATUS.APPROVED) : EDU_STATUS.REJECTED;
    const next = { ...item, status, history: [...item.history, entry] };
    if (isTheme) saveTheme(next);
    else saveLesson(next);
    setConfirm(false);
    toast(
      approve
        ? stage === 'tl'
          ? 'Đã duyệt và chuyển giáo án tới Phó hiệu trưởng'
          : `Đã phê duyệt. ${item.createdBy} sẽ nhận được thông báo.`
        : `Đã từ chối và trả lại cho ${item.createdBy}`,
    );
    navigate(backTo);
  };

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: backLabel, to: backTo }, { label: item.code }]}
        title={title}
        desc={
          <span className="row" style={{ gap: 12 }}>
            <EduStatusBadge status={item.status} size="lg" />
            <span>
              {item.code} · Người lập: {item.createdBy}
            </span>
          </span>
        }
      />

      {item.status !== expected && (
        <div className="mb-16">
          <Notice tone="warn">
            Kế hoạch này không còn ở bước chờ bạn xử lý (đã được xử lý hoặc đã thay đổi). Bạn chỉ xem được nội dung.
          </Notice>
        </div>
      )}

      <div className="ga-split">
        {isTheme ? <ThemeBody t={item} goal={goal} /> : <LessonBody l={item} theme={theme} goal={goal} />}

        <div className="stack">
          <Card title="Chữ ký người lập">
            <SignatureView sig={item.signature || { type: 'saved' }} name={item.createdBy} />
          </Card>
          <Card title="Lịch sử xử lý">
            <History items={item.history} />
          </Card>

          {item.status === expected && (
            <Card
              title={stage === 'tl' ? 'Ý kiến tổ trưởng' : 'Quyết định của Phó hiệu trưởng'}
              foot={
                <>
                  <Link className="btn" to={backTo}>
                    Hủy
                  </Link>
                  <button className="btn btn--primary" onClick={() => validate() && setConfirm(true)}>
                    <Send size={16} aria-hidden /> Xác nhận
                  </button>
                </>
              }
            >
              <div className="stack">
                <div className="field">
                  <span className="field__label">
                    Quyết định<span className="req">*</span>
                  </span>
                  <div className="ga-choice-grid" role="radiogroup" aria-label="Quyết định">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={decision === 'approve'}
                      className={`ga-choice ${decision === 'approve' ? 'ga-choice--selected' : ''}`}
                      onClick={() => {
                        setDecision('approve');
                        setErrors({});
                      }}
                      style={{ padding: 12 }}
                    >
                      <CircleCheck size={20} className="text-success" aria-hidden />
                      <span className="ga-choice__title">{stage === 'tl' ? 'Duyệt' : 'Phê duyệt'}</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={decision === 'reject'}
                      className={`ga-choice ${decision === 'reject' ? 'ga-choice--selected' : ''}`}
                      onClick={() => {
                        setDecision('reject');
                        setErrors({});
                      }}
                      style={{ padding: 12 }}
                    >
                      <CircleX size={20} className="text-danger" aria-hidden />
                      <span className="ga-choice__title">Từ chối</span>
                    </button>
                  </div>
                  {errors.decision && <span className="field__error">{errors.decision}</span>}
                </div>
                <Field
                  label={decision === 'reject' ? 'Lý do từ chối' : 'Nhận xét'}
                  required={decision === 'reject'}
                  error={errors.comment}
                  htmlFor="cmt"
                  counter={`${comment.length}/500`}
                >
                  <textarea
                    id="cmt"
                    className={`textarea ${errors.comment ? 'is-invalid' : ''}`}
                    maxLength={500}
                    placeholder={decision === 'reject' ? 'Nêu rõ nội dung cần chỉnh sửa' : 'Nhận xét chuyên môn (không bắt buộc)'}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </Field>
                {decision === 'approve' && (
                  <div className="field">
                    <span className="field__label">
                      Chữ ký xác nhận<span className="req">*</span>
                    </span>
                    <SignatureBox name={user.name} value={signature} onChange={setSignature} invalid={!!errors.signature} />
                    {errors.signature && <span className="field__error">{errors.signature}</span>}
                  </div>
                )}
                <p className="muted text-xs">
                  {stage === 'tl'
                    ? 'Duyệt: giáo án được chuyển tới Phó hiệu trưởng. Từ chối: giáo án trả lại giáo viên kèm lý do.'
                    : 'Phê duyệt: kế hoạch được lưu và người lập nhận thông báo. Từ chối: kế hoạch trả lại người lập kèm lý do.'}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {confirm && (
        <Modal
          title={decision === 'approve' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
          onClose={() => setConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>
                Quay lại
              </button>
              <button className={`btn ${decision === 'approve' ? 'btn--primary' : 'btn--outline-danger'}`} onClick={apply}>
                {decision === 'approve' ? (stage === 'tl' ? 'Duyệt và chuyển Phó HT' : 'Phê duyệt') : 'Từ chối và trả lại'}
              </button>
            </>
          }
        >
          <p>
            {decision === 'approve'
              ? stage === 'tl'
                ? `Duyệt ${title.toLowerCase()} và chuyển tới Phó hiệu trưởng?`
                : `Phê duyệt ${title.toLowerCase()}? ${isTheme ? 'Giáo viên trong nhóm tuổi sẽ xem được kế hoạch này.' : 'Giáo án sẽ dùng được cho đánh giá trẻ hằng ngày.'}`
              : `Trả ${title.toLowerCase()} lại cho ${item.createdBy} với lý do đã nhập?`}
          </p>
        </Modal>
      )}
    </div>
  );
}
