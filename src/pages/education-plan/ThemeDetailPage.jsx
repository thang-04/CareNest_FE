import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ClipboardCheck, Pencil, Send, Trash2 } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, SCHOOL_SCOPE } from '@/models/education-plan/educationPlanConstants';
import {
  Card,
  EduStatusBadge,
  EmptyState,
  History,
  Modal,
  Notice,
  PageHead,
  SignatureView,
  fmtDate,
} from '@/components/education-plan/eduUi';
import { BranchList, ThemeTable } from '@/components/education-plan/themeShared';

/** Read-only theme plan body, also shown on the review page. */
export function ThemeBody({ t }) {
  return (
    <div className="stack">
      <Card title="Thông tin chủ đề">
        <dl className="info-list">
          <dt>Nhóm tuổi</dt>
          <dd>{AGE_GROUPS.find((a) => a.id === t.ageGroupId)?.name}</dd>
          <dt>Phạm vi</dt>
          <dd>{SCHOOL_SCOPE}</dd>
          <dt>Năm học</dt>
          <dd>{t.schoolYear}</dd>
          <dt>Thời gian</dt>
          <dd>
            {fmtDate(t.startDate)} – {fmtDate(t.endDate)} ({t.weeks} tuần)
          </dd>
          <dt>Người lập</dt>
          <dd>{t.createdBy} · Tổ trưởng nhóm tuổi</dd>
          {t.note && (
            <>
              <dt>Ghi chú</dt>
              <dd>{t.note}</dd>
            </>
          )}
        </dl>
        <div className="ga-divider" />
        <div className="section-title">Chủ đề nhánh</div>
        <BranchList branches={t.branches} />
      </Card>
      <Card title="Mục tiêu và nội dung giáo dục" actions={<span className="muted text-xs">{t.rows?.length || 0} mục tiêu</span>}>
        <ThemeTable rows={t.rows} />
      </Card>
    </div>
  );
}

export default function ThemeDetailPage() {
  const { id } = useParams();
  const { themes, role, lessons, deleteTheme, toast } = useEducationPlan();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const t = themes.find((x) => x.id === id);
  if (!t)
    return (
      <div className="page">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch chủ đề', to: '/education/themes' }]}
          title="Kế hoạch chủ đề"
        />
        <Card>
          <EmptyState
            title="Không tìm thấy kế hoạch chủ đề"
            action={
              <Link className="btn" to="/education/themes">
                Về danh sách
              </Link>
            }
          />
        </Card>
      </div>
    );
  const isTl = role === ROLES.TEAM_LEADER;
  const isVp = role === ROLES.VICE_PRINCIPAL;
  const editable = isTl && (t.status === EDU_STATUS.DRAFT || t.status === EDU_STATUS.REJECTED);
  const usedBy = lessons.filter((l) => l.themeId === t.id);
  const lastReject = t.status === EDU_STATUS.REJECTED && [...t.history].reverse().find((h) => h.tone === 'err');

  return (
    <div className="page">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          isVp
            ? { label: 'Phê duyệt kế hoạch', to: '/education/approvals' }
            : role === ROLES.PRINCIPAL
              ? { label: 'Kế hoạch toàn trường', to: '/education/school' }
              : { label: 'Kế hoạch chủ đề', to: '/education/themes' },
          { label: t.code },
        ]}
        title={`Chủ đề: ${t.name}`}
        desc={
          <span className="row" style={{ gap: 12 }}>
            <EduStatusBadge status={t.status} size="lg" />
            <span>{t.code}</span>
          </span>
        }
        actions={
          <>
            {isTl && t.status === EDU_STATUS.DRAFT && (
              <button type="button" className="btn btn--outline-danger" onClick={() => setModal('delete')}>
                <Trash2 size={16} aria-hidden /> Xóa
              </button>
            )}
            {editable && (
              <Link className="btn btn--outline-primary" to={`/education/themes/${t.id}/edit`}>
                <Pencil size={16} aria-hidden /> Chỉnh sửa
              </Link>
            )}
            {editable && (
              <Link className="btn btn--primary" to={`/education/themes/${t.id}/edit?buoc=ky`}>
                <Send size={16} aria-hidden /> Ký và gửi duyệt
              </Link>
            )}
            {isVp && t.status === EDU_STATUS.PENDING_VP && (
              <Link className="btn btn--primary" to={`/education/approvals/chu-de/${t.id}`}>
                <ClipboardCheck size={16} aria-hidden /> Xét duyệt
              </Link>
            )}
          </>
        }
      />
      {lastReject && (
        <div className="mb-16">
          <Notice tone="err">
            <span className="fw-600">Lý do từ chối:</span> {lastReject.note} Chỉnh sửa rồi gửi duyệt lại.
          </Notice>
        </div>
      )}
      {t.status === EDU_STATUS.PENDING_VP && isTl && (
        <div className="mb-16">
          <Notice>Kế hoạch đang chờ Phó hiệu trưởng duyệt nên tạm thời không chỉnh sửa được.</Notice>
        </div>
      )}
      <div className="ga-split ga-split--wide">
        <ThemeBody t={t} />
        <div className="stack">
          <Card title="Chữ ký người lập">
            <SignatureView sig={t.signature || (t.status !== EDU_STATUS.DRAFT ? { type: 'saved' } : null)} name={t.createdBy} />
          </Card>
          <Card title="Lịch sử xử lý">
            <History items={t.history} />
          </Card>
          <Card title="Giáo án theo chủ đề">
            {usedBy.length ? <p>{usedBy.length} kế hoạch tuần và kế hoạch ngày đã lập theo chủ đề này.</p> : <p>Chưa có giáo án nào.</p>}
          </Card>
        </div>
      </div>

      {modal === 'delete' && (
        <Modal
          title={`Xóa chủ đề “${t.name}”?`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setModal(null)}>
                Giữ lại
              </button>
              <button
                type="button"
                className="btn btn--outline-danger"
                onClick={() => {
                  deleteTheme(t.id);
                  toast('Đã xóa kế hoạch chủ đề');
                  navigate('/education/themes');
                }}
              >
                <Trash2 size={16} aria-hidden /> Xóa kế hoạch
              </button>
            </>
          }
        >
          <p>Kế hoạch nháp sẽ bị xóa và không khôi phục lại được.</p>
        </Modal>
      )}
    </div>
  );
}
