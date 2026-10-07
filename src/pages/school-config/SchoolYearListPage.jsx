import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CalendarRange, Pencil, Play, Archive, Trash2, Shapes, Clock4, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { activateSchoolYear, closeSchoolYear, deleteSchoolYear } from '@/services/school-config/schoolConfigService';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import {
  canActivateYear,
  canCloseYear,
  canConfigureSchool,
  canDeleteYear,
  canEditYear,
  canViewSchoolStructure,
} from '@/utils/school-config/schoolConfigPermissions';
import { yearCrumbs } from '@/utils/school-config/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/school-config.css';

/** #16 School Year List (UC 2.1). Principal configures; other school roles view. */
export default function SchoolYearListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { years, loading, error, reload } = useSchoolYears();
  const [pending, setPending] = useState(null); // { kind, year }

  if (!canViewSchoolStructure(user))
    return (
      <div className="page">
        <Breadcrumb items={yearCrumbs()} />
        <h1 className="page__title">Năm học</h1>
        <ScNoAccess />
      </div>
    );

  const active = years.find((y) => y.status === YEAR_STATUS.ACTIVE);
  const ACTIONS = {
    activate: {
      title: 'Kích hoạt năm học',
      label: 'Kích hoạt năm học',
      run: activateSchoolYear,
      done: 'Đã kích hoạt năm học',
      message: (y) => (
        <>
          Kích hoạt năm học <b>{y.name}</b>?
          {active && (
            <div className="mt-8">
              Năm học đang hoạt động <b>{active.name}</b> sẽ <b>kết thúc</b> và các lớp của năm đó chuyển sang chỉ xem. Phân công Phó hiệu
              trưởng, giáo viên và tổ trưởng của năm {y.name} sẽ được áp dụng.
            </div>
          )}
        </>
      ),
    },
    close: {
      title: 'Kết thúc năm học',
      label: 'Kết thúc năm học',
      danger: true,
      run: closeSchoolYear,
      done: 'Đã kết thúc năm học',
      message: (y) => (
        <>
          Kết thúc năm học <b>{y.name}</b>? Lớp, phân công và dữ liệu của năm học sẽ chỉ còn xem, không sửa được nữa.
        </>
      ),
    },
    remove: {
      title: 'Xóa năm học',
      label: 'Xóa năm học',
      danger: true,
      run: deleteSchoolYear,
      done: 'Đã xóa bản ghi.',
      message: (y) => (
        <>
          Xóa năm học <b>{y.name}</b>? Chỉ xóa được năm học chưa bắt đầu và chưa có lớp.
        </>
      ),
    },
  };
  const action = pending && ACTIONS[pending.kind];

  const confirm = async () => {
    try {
      await action.run(pending.year.id, user);
      toast.success(`${action.done} ${pending.kind === 'remove' ? '' : pending.year.name}`.trim());
      setPending(null);
      reload({ silent: true });
    } catch (err) {
      setPending(null);
      toast.error(err.message, `Không ${action.label.toLowerCase()} được`);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={yearCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Năm học</h1>
        {canConfigureSchool(user) && (
          <Link to="/school/years/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Thêm năm học
          </Link>
        )}
      </div>

      {canConfigureSchool(user) ? (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            Mỗi thời điểm chỉ có <b>một năm học đang hoạt động</b>. Phân công Phó hiệu trưởng, giáo viên và tổ trưởng có hiệu lực trong một
            năm học; năm học mới cần phân công lại.
          </div>
        </div>
      ) : (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>Bạn đang xem danh sách năm học. Chỉ Hiệu trưởng được tạo và cấu hình năm học.</div>
        </div>
      )}

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap sc-table-flat">
            <table className="table">
              <thead>
                <tr>
                  <th>Năm học</th>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                  <th className="center">Số lớp</th>
                  <th>Trạng thái</th>
                  <th className="right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={3} cols={6} />
                ) : years.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={CalendarRange}
                        title="Chưa có năm học"
                        description="Tạo năm học trước khi cấu hình nhóm tuổi, lớp và phân công nhân sự."
                        action={
                          canConfigureSchool(user) && (
                            <Link className="btn btn--primary" to="/school/years/new">
                              <Plus size={16} /> Thêm năm học
                            </Link>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  years.map((y) => (
                    <tr key={y.id}>
                      <td className="fw-600 text-primary">{y.name}</td>
                      <td>{formatDate(y.startDate)}</td>
                      <td>{formatDate(y.endDate)}</td>
                      <td className="center">{y.classCount}</td>
                      <td>
                        <YearStatusBadge status={y.status} />
                      </td>
                      <td className="right nowrap">
                        <Link
                          className="icon-btn"
                          to={`/school/classes?year=${y.id}`}
                          title="Nhóm tuổi & lớp"
                          aria-label={`Nhóm tuổi và lớp năm ${y.name}`}
                        >
                          <Shapes size={17} />
                        </Link>
                        {canConfigureSchool(user) && y.status !== YEAR_STATUS.CLOSED && (
                          <Link
                            className="icon-btn"
                            to={`/school/cutoff?year=${y.id}`}
                            title="Giờ chốt điểm danh"
                            aria-label={`Giờ chốt năm ${y.name}`}
                          >
                            <Clock4 size={17} />
                          </Link>
                        )}
                        {canEditYear(y, user) && (
                          <Link className="icon-btn" to={`/school/years/${y.id}/edit`} title="Sửa" aria-label={`Sửa năm học ${y.name}`}>
                            <Pencil size={17} />
                          </Link>
                        )}
                        {canDeleteYear(y, user) && (
                          <button
                            className="icon-btn"
                            title="Xóa"
                            aria-label={`Xóa năm học ${y.name}`}
                            onClick={() => setPending({ kind: 'remove', year: y })}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                        {canActivateYear(y, user) && (
                          <button className="btn btn--sm btn--primary sc-row-btn" onClick={() => setPending({ kind: 'activate', year: y })}>
                            <Play size={15} /> Kích hoạt
                          </button>
                        )}
                        {canCloseYear(y, user) && (
                          <button className="btn btn--sm sc-row-btn" onClick={() => setPending({ kind: 'close', year: y })}>
                            <Archive size={15} /> Kết thúc
                          </button>
                        )}
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
        title={action?.title}
        message={pending && action?.message(pending.year)}
        confirmLabel={action?.label}
        danger={action?.danger}
        onConfirm={confirm}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
