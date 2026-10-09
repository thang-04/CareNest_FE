import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowSquareOut, Heartbeat } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildDetail } from '@/hooks/children/useChildRecords';
import { SidePanel } from '@/components/ui/SidePanel';
import { LoadingState } from '@/components/ui/States';
import { ChildStatusBadge, ParentAccountBadge } from '@/components/children/ChildBadges';
import { ChildAccessState } from '@/components/children/ChildAccessState';
import { DeclarationSummary } from '@/components/children/DeclarationSummary';
import { GENDER_LABELS, ageGroupById, ageLabel } from '@/models/School';
import { canViewParentAccounts } from '@/utils/children/childrenPermissions';
import { avatarTone, formatDate, formatDateTime, initials } from '@/utils/format';

const missing = <span className="muted">Chưa có thông tin</span>;

/** Xem nhanh đầy đủ hồ sơ trẻ từ danh sách (đọc cùng API với trang hồ sơ); sửa / chuyển lớp vẫn ở trang riêng. */
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

  return (
    <SidePanel
      open={!!current}
      title="Hồ sơ trẻ"
      onClose={onClose}
      footer={
        childId && (
          <>
            <Link className="btn" to={`/children/${childId}/health`}>
              <Heartbeat size={16} /> Sổ sức khỏe
            </Link>
            <Link className="btn btn--primary" to={`/children/${childId}`}>
              <ArrowSquareOut size={16} /> Mở trang hồ sơ
            </Link>
          </>
        )
      }
    >
      {loading && !child ? (
        <LoadingState />
      ) : error || !child ? (
        <ChildAccessState error={error} onRetry={reload} />
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
            <span className={`avatar avatar--xl avatar--tone-${avatarTone(child.fullName)}`} aria-hidden="true">
              {initials(child.fullName)}
            </span>
            <div className="stack" style={{ gap: 4 }}>
              <b className="text-lg">{child.fullName}</b>
              <span className="muted text-sm">
                {child.code}
                {cls?.name ? ` · ${cls.name}` : ''}
              </span>
              <ChildStatusBadge status={child.status} />
            </div>
          </div>

          <section className="stack" style={{ gap: 8 }}>
            <h3 className="subsection-title">Thông tin của trẻ</h3>
            <dl className="info-list">
              <dt>Ngày sinh</dt>
              <dd>
                {formatDate(child.dateOfBirth)} ({ageLabel(child.dateOfBirth)})
              </dd>
              <dt>Giới tính</dt>
              <dd>{GENDER_LABELS[child.gender] || missing}</dd>
              <dt>Ngày tiếp nhận</dt>
              <dd>{child.enrolledAt ? formatDate(child.enrolledAt) : missing}</dd>
              <dt>Dị ứng đã xác nhận</dt>
              <dd>
                {child.allergies?.length ? (
                  <span className="row row--wrap" style={{ gap: 6 }}>
                    {child.allergies.map((a) => (
                      <span key={a} className="chip chip--red">
                        {a}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="muted">Không có</span>
                )}
              </dd>
            </dl>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h3 className="subsection-title">Lớp & năm học</h3>
            <dl className="info-list">
              <dt>Điểm trường</dt>
              <dd>{md.campusById(child.campusId)?.name || missing}</dd>
              <dt>Năm học</dt>
              <dd>{cls?.schoolYear || missing}</dd>
              <dt>Nhóm tuổi</dt>
              <dd>{ageGroupById(cls?.ageGroupId)?.name || missing}</dd>
              <dt>Lớp</dt>
              <dd>{cls?.name || <span className="muted">Chưa xếp lớp</span>}</dd>
              <dt>Giáo viên chủ nhiệm</dt>
              <dd>{md.userById(cls?.homeroomTeacherId)?.fullName || missing}</dd>
            </dl>
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h3 className="subsection-title">Phụ huynh / người giám hộ</h3>
            {child.guardians.length === 0 ? (
              <p className="muted">Chưa có thông tin phụ huynh.</p>
            ) : (
              child.guardians.map((g) => (
                <div key={`${g.phone}${g.fullName}`} className="stack" style={{ gap: 2 }}>
                  <span className="fw-600">
                    {g.fullName} <span className="muted">({g.relation})</span>
                  </span>
                  <span className="text-sm">
                    {g.phone || missing}
                    {g.email ? ` · ${g.email}` : ''}
                  </span>
                  {canViewParentAccounts(user) && (
                    <span>
                      <ParentAccountBadge status={g.accountStatus} />
                    </span>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h3 className="subsection-title">Sức khỏe khi tiếp nhận</h3>
            <DeclarationSummary
              declaration={detail.declaration}
              confirmedAllergies={child.allergies}
              confirmedByName={detail.declaration?.confirmedByName}
            />
          </section>

          <section className="stack" style={{ gap: 8 }}>
            <h3 className="subsection-title">Lịch sử xếp lớp</h3>
            {detail.placements.length === 0 ? (
              <p className="muted">Chưa có thay đổi lớp nào được ghi nhận.</p>
            ) : (
              <ul className="history-list">
                {detail.placements.map((p) => (
                  <li key={p.id}>
                    <span className="history-list__dot" />
                    <div>
                      <div>
                        {p.fromClassName ? (
                          <>
                            Chuyển từ <b>{p.fromClassName}</b> sang <b>{p.toClassName}</b>
                          </>
                        ) : (
                          <>
                            Xếp vào <b>{p.toClassName}</b>
                          </>
                        )}
                      </div>
                      <div className="muted text-sm">
                        {p.userName} · {formatDateTime(p.at)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </SidePanel>
  );
}
