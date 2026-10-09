import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layers, Pencil, Send, Trash2 } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, SCHOOL_SCOPE, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { Card, EduStatusBadge, EmptyState, Modal, Notice, PageHead, SignatureView, fmtDate } from '@/components/education-plan/eduUi';

export default function GoalDetailPage() {
  const { id } = useParams();
  const { goals, themes, role, saveGoal, deleteGoal, toast } = useEducationPlan();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const g = goals.find((x) => x.id === id);

  if (!g)
    return (
      <div className="page">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học', to: '/education/goals' }]}
          title="Mục tiêu năm học"
        />
        <Card>
          <EmptyState
            title="Không tìm thấy mục tiêu năm học"
            action={
              <Link className="btn" to="/education/goals">
                Về danh sách
              </Link>
            }
          />
        </Card>
      </div>
    );

  const isVP = role === ROLES.VICE_PRINCIPAL;
  const isPrincipal = role === ROLES.PRINCIPAL;
  const isDraft = g.status === EDU_STATUS.DRAFT;
  const ageName = AGE_GROUPS.find((a) => a.id === g.ageGroupId)?.name;
  const usedBy = themes.filter((t) => t.goalId === g.id);

  return (
    <div className="page">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          isPrincipal ? { label: 'Kế hoạch toàn trường', to: '/education/school' } : { label: 'Mục tiêu năm học', to: '/education/goals' },
          { label: g.code },
        ]}
        title={g.title}
        desc={
          <span className="row" style={{ gap: 12 }}>
            <EduStatusBadge status={g.status} size="lg" />
            <span>{g.code}</span>
          </span>
        }
        actions={
          isVP ? (
            <>
              {isDraft && (
                <button className="btn btn--outline-danger" onClick={() => setModal('delete')}>
                  <Trash2 size={16} aria-hidden /> Xóa
                </button>
              )}
              <Link className="btn btn--outline-primary" to={`/education/goals/${g.id}/edit`}>
                <Pencil size={16} aria-hidden /> Chỉnh sửa
              </Link>
              {isDraft && (
                <button
                  className="btn btn--primary"
                  onClick={() => (g.signature ? setModal('send') : navigate(`/education/goals/${g.id}/edit?buoc=ky`))}
                >
                  <Send size={16} aria-hidden /> Gửi tổ trưởng
                </button>
              )}
            </>
          ) : (
            role === ROLES.TEAM_LEADER && (
              <Link className="btn btn--primary" to="/education/themes/new">
                <Layers size={16} aria-hidden /> Lập kế hoạch chủ đề
              </Link>
            )
          )
        }
      />

      {isVP && isDraft && !g.signature && (
        <div className="mb-16">
          <Notice tone="warn">Bộ mục tiêu chưa được ký. Bấm “Gửi tổ trưởng” để duyệt lại nội dung và ký trước khi gửi.</Notice>
        </div>
      )}

      <div className="ga-split">
        <div className="stack">
          <Card title="Thông tin chung">
            <dl className="info-list">
              <dt>Năm học</dt>
              <dd>{g.schoolYear}</dd>
              <dt>Nhóm tuổi áp dụng</dt>
              <dd>{ageName}</dd>
              <dt>Phạm vi</dt>
              <dd>{SCHOOL_SCOPE}</dd>
              <dt>Người lập</dt>
              <dd>{g.createdBy} · Phó hiệu trưởng</dd>
              <dt>Ngày lập</dt>
              <dd>{fmtDate(g.createdAt)}</dd>
              <dt>Ngày gửi</dt>
              <dd>{fmtDate(g.sentAt)}</dd>
              <dt>Mô tả</dt>
              <dd>{g.description || '—'}</dd>
            </dl>
          </Card>
          <Card title="Mục tiêu theo lĩnh vực" actions={<span className="muted text-xs">{allGoalItems(g).length} mục tiêu</span>}>
            {g.domains.map((d) => (
              <div className="ga-domain" key={d.name}>
                <div className="ga-domain__head">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="ga-domain__bar" aria-hidden />
                    <h3 className="subsection-title">{d.name}</h3>
                  </div>
                  <span className="muted text-xs">{d.items.length} mục tiêu</span>
                </div>
                <div className="ga-domain__body">
                  {d.items.map((it) => (
                    <div key={it.id} className="ga-goal-row ga-goal-row--read">
                      <span className="ga-goal-code">{it.code}</span>
                      <span>{it.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </div>
        <div className="stack">
          <Card title="Chữ ký người lập">
            <SignatureView sig={g.signature || (g.status === EDU_STATUS.SENT ? { type: 'saved' } : null)} name={g.createdBy} />
            <p className="muted text-xs mt-12">
              {g.createdBy} · Phó hiệu trưởng{g.sentAt ? ` · ký ngày ${fmtDate(g.sentAt)}` : ''}
            </p>
          </Card>
          <Card title="Kế hoạch chủ đề sử dụng">
            {usedBy.length === 0 ? (
              <p>Chưa có kế hoạch chủ đề nào dùng bộ mục tiêu này.</p>
            ) : (
              usedBy.map((t) => (
                <div key={t.id} className="ga-summary-row">
                  <span>
                    <div className="fw-600">{t.name}</div>
                    <div className="muted text-xs">
                      {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                    </div>
                  </span>
                  <EduStatusBadge status={t.status} />
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      {modal === 'send' && (
        <Modal
          title="Gửi mục tiêu năm học"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button
                className="btn btn--primary"
                onClick={() => {
                  saveGoal({ ...g, status: EDU_STATUS.SENT, sentAt: new Date().toISOString().slice(0, 10) });
                  setModal(null);
                  toast(`Đã gửi mục tiêu cho tổ trưởng ${ageName}`);
                }}
              >
                <Send size={16} aria-hidden /> Gửi tổ trưởng
              </button>
            </>
          }
        >
          <p>Tổ trưởng {ageName} sẽ nhận thông báo và xem được bộ mục tiêu này.</p>
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal
          title={`Xóa “${g.title}”?`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Giữ lại
              </button>
              <button
                className="btn btn--outline-danger"
                disabled={usedBy.length > 0}
                onClick={() => {
                  deleteGoal(g.id);
                  toast('Đã xóa mục tiêu năm học');
                  navigate('/education/goals');
                }}
              >
                <Trash2 size={16} aria-hidden /> Xóa mục tiêu
              </button>
            </>
          }
        >
          {usedBy.length > 0 ? (
            <Notice tone="err">Không xóa được vì đã có kế hoạch chủ đề sử dụng bộ mục tiêu này.</Notice>
          ) : (
            <p>Bộ mục tiêu nháp sẽ bị xóa khỏi hệ thống và không khôi phục lại được.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
