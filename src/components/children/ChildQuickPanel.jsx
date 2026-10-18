import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowSquareOut, ClipboardText, Heartbeat, Pencil, Phone } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildDetail } from '@/hooks/children/useChildRecords';
import { SidePanel } from '@/components/ui/SidePanel';
import { LoadingState } from '@/components/ui/States';
import { ChildStatusBadge, ParentAccountBadge } from '@/components/children/ChildBadges';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { ALLERGY_STATE_LABELS, DECLARATION_STATE, DIET_STATE_LABELS } from '@/models/children/childrenConstants';
import { CHILD_STATUS, GENDER_LABELS, ageLabel } from '@/models/School';
import { canEditChild, canViewParentAccounts } from '@/utils/children/childrenPermissions';
import { avatarTone, formatDate, initials } from '@/utils/format';

const missing = <span className="muted">Chưa cập nhật</span>;

/** Dị ứng theo trạng thái khai báo: "chưa cung cấp" không được hiển thị như "không có". */
function AllergyValue({ declaration }) {
  const a = declaration?.allergies;
  if (!a) return <span className="muted">Chưa khai báo</span>;
  if (a.state !== DECLARATION_STATE.REPORTED)
    return a.state === DECLARATION_STATE.NOT_PROVIDED ? (
      <span className="chip chip--orange">{ALLERGY_STATE_LABELS[a.state]}</span>
    ) : (
      <span>{ALLERGY_STATE_LABELS[a.state]}</span>
    );
  return (
    <span className="row row--wrap gap-1-5">
      {a.items.map((x) => (
        <span key={x} className="chip chip--red">
          {x}
        </span>
      ))}
    </span>
  );
}

/** Xem nhanh hồ sơ trẻ từ danh sách: tóm tắt + lối tắt; chi tiết đầy đủ và lịch sử ở trang hồ sơ. */
export function ChildQuickPanel({ childId: current, onClose }) {
  const { user } = useAuth();
  const md = useMasterData();
  // Giữ mã trẻ vừa xem để panel còn nội dung trong lúc trượt ra
  const last = useRef(current);
  if (current) last.current = current;
  const childId = current || last.current;
  const { detail, loading, error, reload } = useChildDetail(childId);
  const child = detail?.child;
  const cls = detail?.cls;
  const declaration = detail?.declaration;
  const left = child?.status === CHILD_STATUS.LEFT;

  return (
    <SidePanel
      open={!!current}
      title="Hồ sơ trẻ"
      onClose={onClose}
      footer={
        childId && (
          <Link className="btn btn--primary" to={`/children/${childId}`}>
            <ArrowSquareOut size={16} /> Mở trang hồ sơ
          </Link>
        )
      }
    >
      {loading && !child ? (
        <LoadingState />
      ) : error || !child ? (
        <ChildAccessState error={error} onRetry={reload} />
      ) : (
        <div className="stack gap-5">
          <div className="row gap-3-5 tr-quick__head">
            <span className={`avatar avatar--xl avatar--tone-${avatarTone(child.fullName)}`} aria-hidden="true">
              {initials(child.fullName)}
            </span>
            <div className="stack gap-1">
              <b className="text-lg">{child.fullName}</b>
              <span className="muted text-sm">
                {child.code}
                {cls?.name ? ` · ${cls.name}` : ' · Chưa xếp lớp'}
              </span>
              <span>
                <ChildStatusBadge status={child.status} />
              </span>
            </div>
          </div>

          <div className="row row--wrap gap-2">
            {canEditChild(child, user) && (
              <Link className="btn btn--sm" to={`/children/${child.id}/edit`}>
                <Pencil size={15} /> Sửa hồ sơ
              </Link>
            )}
            <Link className="btn btn--sm" to={`/children/${child.id}/health`}>
              <Heartbeat size={15} /> Sổ sức khỏe
            </Link>
            <Link className="btn btn--sm" to={`/children/${child.id}/health-declaration`}>
              <ClipboardText size={15} /> Khai báo sức khỏe
            </Link>
          </div>

          <section className="stack gap-2">
            <h3 className="subsection-title">Thông tin</h3>
            <dl className="info-list">
              <dt>Ngày sinh</dt>
              <dd>
                {formatDate(child.dateOfBirth)} ({ageLabel(child.dateOfBirth)})
              </dd>
              <dt>Giới tính</dt>
              <dd>{GENDER_LABELS[child.gender] || missing}</dd>
              <dt>Lớp</dt>
              <dd>
                {cls?.name || <span className="muted">Chưa xếp lớp</span>}
                <span className="muted"> · {md.campusById(child.campusId)?.name || '—'}</span>
              </dd>
              <dt>Giáo viên chủ nhiệm</dt>
              <dd>{md.userById(cls?.homeroomTeacherId)?.fullName || missing}</dd>
              <dt>Ngày tiếp nhận</dt>
              <dd>{child.enrolledAt ? formatDate(child.enrolledAt) : missing}</dd>
              {left && (
                <div className="tr-dl-pair">
                  <dt>Nghỉ học</dt>
                  <dd>
                    {child.leftAt ? formatDate(child.leftAt) : missing}
                    {child.leftReason ? <span className="muted"> · {child.leftReason}</span> : null}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="stack gap-2">
            <h3 className="subsection-title">Dị ứng & chế độ ăn</h3>
            <dl className="info-list">
              <dt>Dị ứng</dt>
              <dd>
                <AllergyValue declaration={declaration} />
              </dd>
              <dt>Chế độ ăn</dt>
              <dd>
                {!declaration
                  ? missing
                  : declaration.diet.state === DECLARATION_STATE.REPORTED
                    ? declaration.diet.text
                    : DIET_STATE_LABELS[declaration.diet.state]}
              </dd>
            </dl>
          </section>

          <section className="stack gap-2">
            <h3 className="subsection-title">Phụ huynh / người giám hộ</h3>
            {child.guardians.length === 0 ? (
              <p className="muted">Chưa có thông tin phụ huynh.</p>
            ) : (
              child.guardians.map((g) => (
                <div key={`${g.phone}${g.fullName}`} className="tr-quick__guardian">
                  <div className="stack gap-0-5">
                    <span className="fw-600">
                      {g.fullName} <span className="muted">({g.relation})</span>
                    </span>
                    <span className="text-sm muted">{g.email || 'Chưa có email'}</span>
                    {canViewParentAccounts(user) && (
                      <span>
                        <ParentAccountBadge status={g.accountStatus} />
                      </span>
                    )}
                  </div>
                  {g.phone && (
                    <a className="btn btn--sm" href={`tel:${g.phone.replace(/\s/g, '')}`} aria-label={`Gọi ${g.fullName} số ${g.phone}`}>
                      <Phone size={15} /> {g.phone}
                    </a>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      )}
    </SidePanel>
  );
}
