import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Building2, Star, PauseCircle, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { setCampusStatus } from '@/services/school-config/schoolConfigService';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useCampusList } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { UnassignedBadge } from '@/components/school-config/SchoolConfigBadges';
import { canListCampuses, canManageCampus } from '@/utils/school-config/schoolConfigPermissions';
import { campusCrumbs } from '@/utils/school-config/breadcrumbs';
import { YearReadOnlyNotice } from '@/components/school-config/YearReadOnlyNotice';
import '@/styles/modules/school-config.css';

/** #20 Campus List (UC 2.3). Principal manages; a Vice Principal sees the assigned campus. */
export default function CampusListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { schoolYear, yearReadOnly } = useSchoolYear();
  const { campuses, loading, error, reload } = useCampusList(schoolYear);
  const manage = canManageCampus(user) && !yearReadOnly;
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [pending, setPending] = useState(null);
  const [pendingError, setPendingError] = useState('');
  const shown = campuses.filter((c) => !statusFilter || (c.status || 'ACTIVE') === statusFilter);
  const confirmStatus = async () => {
    try {
      const next = pending.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
      await setCampusStatus(pending.id, next, user);
      toast.success(next === 'INACTIVE' ? `Đã ngừng hoạt động ${pending.shortName}` : `${pending.shortName} đã hoạt động lại`);
      setPending(null);
      setPendingError('');
      reload({ silent: true });
    } catch (err) {
      setPendingError(err.message);
    }
  };

  if (!canListCampuses(user))
    return (
      <div className="page">
        <Breadcrumb items={campusCrumbs()} />
        <h1 className="page__title">Điểm trường</h1>
        <ScNoAccess />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={campusCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Điểm trường</h1>
        {manage && (
          <Link to="/school/campuses/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Thêm điểm trường
          </Link>
        )}
      </div>
      <YearReadOnlyNotice />
      <div className="card mb-16">
        <div className="filter-bar">
          <select
            className="select sc-inline-select"
            aria-label="Trạng thái"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Ngừng hoạt động</option>
          </select>
        </div>
      </div>

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap sc-table-flat">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Điểm trường</th>
                  <th>Địa chỉ</th>
                  <th>Phó hiệu trưởng phụ trách</th>
                  <th className="num">Lớp ({schoolYear})</th>
                  <th className="num">Trẻ</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={2} cols={7} />
                ) : shown.length === 0 && campuses.length ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState icon={Building2} title="Không có điểm trường khớp bộ lọc" description="Chọn trạng thái khác để xem." />
                    </td>
                  </tr>
                ) : campuses.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={Building2}
                        title="Chưa có điểm trường"
                        description="Thêm điểm trường chính trước khi cấu hình lớp và phân công nhân sự."
                        action={
                          manage && (
                            <Link className="btn btn--primary" to="/school/campuses/new">
                              <Plus size={16} /> Thêm điểm trường
                            </Link>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  shown.map((c) => (
                    <tr
                      key={c.id}
                      className={`row-click${c.status === 'INACTIVE' ? ' muted' : ''}`}
                      onClick={() => navigate(`/school/campuses/${c.id}`)}
                    >
                      <td className="fw-600 text-primary">{c.code}</td>
                      <td>
                        <div className="fw-600">{c.shortName}</div>
                        <div className="text-xs muted sc-wrap">{c.name}</div>
                        {c.isMain && (
                          <span className="chip chip--teal mt-8">
                            <Star size={12} /> Điểm trường chính
                          </span>
                        )}
                        {c.status === 'INACTIVE' && <span className="chip chip--gray mt-8">Ngừng hoạt động</span>}
                      </td>
                      <td className="text-sm sc-wrap">{c.address}</td>
                      <td>
                        {c.vicePrincipals.length ? c.vicePrincipals.map((v) => <div key={v.id}>{v.fullName}</div>) : <UnassignedBadge />}
                      </td>
                      <td className="num">{c.classCount}</td>
                      <td className="num">{c.childCount}</td>
                      <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          view={{ to: `/school/campuses/${c.id}` }}
                          edit={manage ? { to: `/school/campuses/${c.id}/edit` } : null}
                          menu={
                            manage
                              ? [
                                  c.status === 'INACTIVE'
                                    ? { label: 'Hoạt động lại', icon: RotateCcw, onClick: () => setPending(c) }
                                    : {
                                        label: 'Ngừng hoạt động',
                                        icon: PauseCircle,
                                        danger: true,
                                        disabled: c.isMain,
                                        onClick: () => setPending(c),
                                      },
                                ]
                              : []
                          }
                          name={c.shortName}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmationModal
        open={!!pending}
        title={pending?.status === 'INACTIVE' ? 'Hoạt động lại điểm trường' : 'Ngừng hoạt động điểm trường'}
        message={
          pending &&
          (pending.status === 'INACTIVE' ? (
            <>
              Cho <b>{pending.shortName}</b> hoạt động lại? Điểm trường được chọn lại khi tạo lớp, phòng.
            </>
          ) : (
            <>
              Ngừng hoạt động <b>{pending.shortName}</b>? Không chọn được điểm trường này khi tạo lớp, phòng mới. Dữ liệu năm cũ vẫn xem
              được. Chỉ ngừng được khi năm đang hoạt động và năm sắp diễn ra không còn lớp ở điểm này và không còn Phó hiệu trưởng phụ
              trách.
            </>
          ))
        }
        confirmLabel={pending?.status === 'INACTIVE' ? 'Hoạt động lại' : 'Ngừng hoạt động'}
        danger={pending?.status !== 'INACTIVE'}
        onConfirm={confirmStatus}
        error={pendingError}
        onClose={() => {
          setPending(null);
          setPendingError('');
        }}
      />
    </div>
  );
}
