import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Save, Send, Trash2 } from 'lucide-react';
import { ROLES } from '@/models/User';
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
  SignatureView,
  fmtDate,
} from '@/components/education-plan/eduUi';
import { LessonBody, daysOf, typeLabel } from '@/components/education-plan/lessonShared';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';

/** Notes written after teaching: always editable by the owner, even once the plan is approved. */
function AfterTeaching({ l, editable, onSave }) {
  const [dayNotes, setDayNotes] = useState(l.dayNotes || {});
  const [weekReview, setWeekReview] = useState(l.weekReview || '');
  const [dayReview, setDayReview] = useState(l.dayReview || '');
  const [adjust, setAdjust] = useState(l.adjust || '');
  const dirty =
    l.type === 'week'
      ? JSON.stringify(dayNotes) !== JSON.stringify(l.dayNotes || {}) || weekReview !== (l.weekReview || '')
      : dayReview !== (l.dayReview || '') || adjust !== (l.adjust || '');

  return (
    <Card
      title={l.type === 'week' ? 'Nhận xét và điều chỉnh' : 'Đánh giá sau khi dạy'}
      actions={
        editable && (
          <button
            className="btn btn--sm btn--primary"
            disabled={!dirty}
            onClick={() => onSave(l.type === 'week' ? { dayNotes, weekReview } : { dayReview, adjust })}
          >
            <Save size={16} aria-hidden /> Lưu
          </button>
        )
      }
    >
      {l.type === 'week' ? (
        <div className="stack">
          <div className="ga-after-days">
            {daysOf(l.weekStart).map((d) => (
              <Field key={d.date} label={`${d.label} ${fmtDate(d.date).slice(0, 5)}`} htmlFor={`nx-${d.date}`}>
                <textarea
                  id={`nx-${d.date}`}
                  className="textarea"
                  rows={3}
                  readOnly={!editable}
                  placeholder="Nhận xét cuối ngày"
                  value={dayNotes[d.date] || ''}
                  onChange={(e) => setDayNotes({ ...dayNotes, [d.date]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <Field label="Đánh giá và điều chỉnh kế hoạch" htmlFor="wr">
            <textarea
              id="wr"
              className="textarea"
              rows={2}
              readOnly={!editable}
              placeholder="Điều chỉnh mục tiêu, nội dung, mức độ hỗ trợ cho tuần sau"
              value={weekReview}
              onChange={(e) => setWeekReview(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <div className="ga-plan-grid">
          <Field label="Đánh giá cuối ngày" htmlFor="dr">
            <textarea
              id="dr"
              className="textarea"
              rows={3}
              readOnly={!editable}
              placeholder="Trẻ hứng thú, đạt yêu cầu ở mức nào…"
              value={dayReview}
              onChange={(e) => setDayReview(e.target.value)}
            />
          </Field>
          <Field label="Điều chỉnh / hỗ trợ cá nhân (nếu có)" htmlFor="ad">
            <textarea
              id="ad"
              className="textarea"
              rows={3}
              readOnly={!editable}
              placeholder="Trẻ cần hỗ trợ thêm, nội dung cần ôn lại"
              value={adjust}
              onChange={(e) => setAdjust(e.target.value)}
            />
          </Field>
        </div>
      )}
      {editable && <p className="muted text-xs mt-12">Phần này không cần duyệt lại, giáo viên ghi được cả khi giáo án đã duyệt.</p>}
    </Card>
  );
}

export default function LessonDetailPage() {
  const { id } = useParams();
  const { lessons, themes, role, user, saveLesson, deleteLesson, toast } = useEducationPlan();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const l = lessons.find((x) => x.id === id);
  if (!l)
    return (
      <div className="page">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Giáo án của lớp', to: '/education/lessons' }]}
          title="Không tìm thấy giáo án"
        />
        <Card>
          <EmptyState
            title="Không tìm thấy giáo án"
            action={
              <Link className="btn" to="/education/lessons">
                Về danh sách
              </Link>
            }
          />
        </Card>
      </div>
    );
  const theme = themes.find((t) => t.id === l.themeId);
  const isOwner = (role === ROLES.TEACHER || role === ROLES.TEAM_LEADER) && l.classId === user.classId;
  const editable = isOwner && (l.status === EDU_STATUS.DRAFT || l.status === EDU_STATUS.REJECTED);
  const lastReject = l.status === EDU_STATUS.REJECTED && [...l.history].reverse().find((h) => h.tone === 'err');

  return (
    <div className="page">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          role === ROLES.PRINCIPAL
            ? { label: 'Kế hoạch toàn trường', to: '/education/school' }
            : { label: 'Giáo án của lớp', to: '/education/lessons' },
          { label: l.code },
        ]}
        title={`${typeLabel(l.type)} · Tuần ${l.weekIndex}: ${l.branch}`}
        desc={
          <span className="row" style={{ gap: 12 }}>
            <EduStatusBadge status={l.status} size="lg" />
            <span>{l.code}</span>
          </span>
        }
        actions={
          <>
            {isOwner && l.status === EDU_STATUS.DRAFT && (
              <button className="btn btn--outline-danger" onClick={() => setModal('delete')}>
                <Trash2 size={16} aria-hidden /> Xóa
              </button>
            )}
            {editable && (
              <Link className="btn btn--outline-primary" to={`/education/lessons/${l.id}/edit`}>
                <Pencil size={16} aria-hidden /> Chỉnh sửa
              </Link>
            )}
            {editable && (
              <Link className="btn btn--primary" to={`/education/lessons/${l.id}/edit?buoc=ky`}>
                <Send size={16} aria-hidden /> Ký và gửi tổ trưởng
              </Link>
            )}
          </>
        }
      />
      {lastReject && (
        <div className="mb-16">
          <Notice tone="err">
            <span className="fw-600">{lastReject.by} đã từ chối:</span> {lastReject.note} Chỉnh sửa rồi gửi lại.
          </Notice>
        </div>
      )}
      {(l.status === EDU_STATUS.PENDING_TL || l.status === EDU_STATUS.PENDING_VP) && (
        <div className="mb-16">
          <Notice>
            {l.status === EDU_STATUS.PENDING_TL
              ? 'Đang chờ tổ trưởng nhóm tuổi xem xét chuyên môn.'
              : 'Tổ trưởng đã duyệt, đang chờ Phó hiệu trưởng phê duyệt.'}
          </Notice>
        </div>
      )}
      {l.status === EDU_STATUS.APPROVED && (
        <div className="mb-16">
          <Notice tone="ok">Giáo án đã được phê duyệt và dùng được cho đánh giá trẻ hằng ngày.</Notice>
        </div>
      )}
      <div className="ga-split ga-split--wide">
        <div className="stack">
          <LessonBody l={l} theme={theme} />
          <AfterTeaching
            key={l.id}
            l={l}
            editable={isOwner}
            onSave={(patch) => {
              saveLesson({ ...l, ...patch });
              toast('Đã lưu nhận xét');
            }}
          />
        </div>
        <div className="stack">
          <Card title="Chữ ký người lập">
            <SignatureView sig={l.signature || (l.status !== EDU_STATUS.DRAFT ? { type: 'saved' } : null)} name={l.createdBy} />
          </Card>
          <Card title="Lịch sử xử lý">
            <History items={l.history} />
          </Card>
        </div>
      </div>

      {modal === 'delete' && (
        <Modal
          title={`Xóa giáo án ${l.code}?`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Giữ lại
              </button>
              <button
                className="btn btn--outline-danger"
                onClick={() => {
                  deleteLesson(l.id);
                  toast('Đã xóa giáo án');
                  navigate('/education/lessons');
                }}
              >
                <Trash2 size={16} aria-hidden /> Xóa giáo án
              </button>
            </>
          }
        >
          <p>Giáo án nháp sẽ bị xóa và không khôi phục lại được.</p>
        </Modal>
      )}
    </div>
  );
}
