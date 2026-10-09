import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Shapes, Info, Utensils, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolStructure, useSchoolYears } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { YearStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { YearPicker } from '@/components/school-config/YearPicker';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { ClassFormModal } from '@/components/school-config/ClassFormModal';
import { AgeGroupFormModal } from '@/components/school-config/AgeGroupFormModal';
import { deleteAgeGroup, deleteClass } from '@/services/school-config/schoolConfigService';
import { canManageAgeGroups, canManageClasses, canViewSchoolStructure, isPrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { classCrumbs } from '@/utils/school-config/breadcrumbs';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';
import '@/styles/modules/school-config.css';

/** #18 Age Groups & Classes (UC 2.2). Principal configures; VP / team leader / teacher view their scope. */
export default function AgeGroupsClassesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { schoolYear: headerYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const yearId = params.get('year') || headerYear;
  const [campusId, setCampusId] = useState('');
  const md = useMasterData();
  const { years, error: yearsError } = useSchoolYears();
  const { structure, loading, error, reload } = useSchoolStructure(yearId, campusId);
  const [classModal, setClassModal] = useState(null); // { cls, defaults }
  const [groupModal, setGroupModal] = useState(null); // { group }
  const [removing, setRemoving] = useState(null); // { kind, item }

  const year = structure?.year;
  const ageGroups = useMemo(() => structure?.ageGroups || [], [structure]);
  const classes = useMemo(() => structure?.classes || [], [structure]);
  const editable = canManageClasses(year, user);
  const principal = isPrincipal(user);
  // Principal sees both campuses; other roles only the campus of their scope (GBR-GEN-01).
  const campuses = principal ? md.campuses : md.campuses.filter((c) => c.id === user?.campusId);

  if (!canViewSchoolStructure(user))
    return (
      <div className="page">
        <Breadcrumb items={classCrumbs()} />
        <h1 className="page__title">Nhóm tuổi & lớp</h1>
        <ScNoAccess />
      </div>
    );

  const teacherNames = (ids) =>
    ids
      .map((id) => md.userById(id)?.fullName)
      .filter(Boolean)
      .join(', ');
  const roomOf = (c) => {
    const l = c.locationId && md.locationById(c.locationId);
    return l ? l.room || l.name : '—';
  };

  const confirmRemove = async () => {
    try {
      if (removing.kind === 'class') await deleteClass(removing.item.id, user);
      else await deleteAgeGroup(removing.item.id, user);
      toast.success('Đã xóa bản ghi.');
      setRemoving(null);
      reload({ silent: true });
    } catch (err) {
      setRemoving(null);
      toast.error(err.message, 'Không xóa được');
    }
  };

  const closeClassModal = (changed) => {
    setClassModal(null);
    if (changed) reload({ silent: true });
  };
  const closeGroupModal = (changed) => {
    setGroupModal(null);
    if (changed) reload({ silent: true });
  };

  const groupsToShow = ageGroups.filter((g) => editable || classes.some((c) => c.ageGroupId === g.id));

  return (
    <div className="page">
      <Breadcrumb items={classCrumbs()} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">Nhóm tuổi & lớp</h1>
          {year && <YearStatusBadge status={year.status} />}
        </div>
        {editable && (
          <button className="btn btn--primary btn--lg" onClick={() => setClassModal({ cls: null, defaults: { campusId } })}>
            <Plus size={18} /> Thêm lớp
          </button>
        )}
      </div>

      <div className="card mb-16">
        <div className="filter-bar">
          <YearPicker years={years} value={yearId} onChange={(v) => setParams({ year: v })} />
          <div className="sc-inline-field">
            <label className="field__label" htmlFor="sc-campus">
              Điểm trường
            </label>
            <select id="sc-campus" className="select" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
              {principal && <option value="">Tất cả điểm trường</option>}
              {!principal && <option value="">Điểm trường của tôi</option>}
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {yearsError && <ErrorState error={yearsError} />}
      {!editable && year && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            {year.status === YEAR_STATUS.CLOSED
              ? `Năm học ${year.name} đã kết thúc: lớp và nhóm tuổi chỉ còn xem.`
              : principal
                ? 'Bạn đang xem cấu hình.'
                : 'Bạn đang xem các lớp trong phạm vi được phân công. Chỉ Hiệu trưởng được cấu hình nhóm tuổi và lớp.'}
          </div>
        </div>
      )}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !structure ? (
        <LoadingState />
      ) : (
        <>
          <section className="mb-16">
            <div className="row row--between mb-8">
              <h2 className="section-title">Nhóm tuổi</h2>
              {principal && canManageAgeGroups(user) && (
                <button className="btn btn--sm" onClick={() => setGroupModal({ group: null })}>
                  <Plus size={15} /> Thêm nhóm tuổi
                </button>
              )}
            </div>
            <div className="sc-group-grid">
              {ageGroups.map((g) => {
                const count = classes.filter((c) => c.ageGroupId === g.id).length;
                return (
                  <article key={g.id} className="card sc-group-card">
                    <div className="row row--between">
                      <h3 className="card__title">{g.name}</h3>
                      {principal && (
                        <span className="row" style={{ gap: 2 }}>
                          <button
                            className="icon-btn"
                            aria-label={`Sửa nhóm tuổi ${g.shortName}`}
                            title="Sửa"
                            onClick={() => setGroupModal({ group: g })}
                          >
                            <Pencil size={16} />
                          </button>
                          {count === 0 && (
                            <button
                              className="icon-btn"
                              aria-label={`Xóa nhóm tuổi ${g.shortName}`}
                              title="Xóa"
                              onClick={() => setRemoving({ kind: 'group', item: g })}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="sc-group-card__meta text-sm text-2">
                      <span>{g.ageRange}</span>
                      <span className="row" style={{ gap: 4 }}>
                        <Utensils size={14} /> {g.mealsPerDay} bữa/ngày
                      </span>
                      <span className="row" style={{ gap: 4 }}>
                        <Shapes size={14} /> {count} lớp
                      </span>
                    </div>
                    {g.nutritionNote && <p className="text-xs muted sc-group-card__note">{g.nutritionNote}</p>}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Lớp năm học {year?.name}</h2>
              <span className="muted text-sm">{classes.length} lớp</span>
            </div>
            <div className="table-wrap sc-table-flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lớp</th>
                    {principal && <th>Điểm trường</th>}
                    <th>Phòng</th>
                    <th className="center">Sĩ số</th>
                    <th>Chủ nhiệm</th>
                    <th>Giáo viên</th>
                    {editable && <th className="right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows rows={4} cols={editable ? 7 : 6} />
                  ) : classes.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          icon={Shapes}
                          title="Chưa có lớp trong năm học này"
                          description={
                            editable ? 'Thêm lớp cho từng nhóm tuổi và điểm trường.' : 'Lớp được Hiệu trưởng cấu hình sẽ hiển thị tại đây.'
                          }
                          action={
                            editable && (
                              <button className="btn btn--primary" onClick={() => setClassModal({ cls: null, defaults: { campusId } })}>
                                <Plus size={16} /> Thêm lớp
                              </button>
                            )
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    groupsToShow.map((g) => {
                      const rows = classes.filter((c) => c.ageGroupId === g.id);
                      return [
                        <tr key={`h-${g.id}`} className="sc-group-row">
                          <td colSpan={7}>
                            <span className="fw-600">{g.name}</span> <span className="muted text-sm">· {rows.length} lớp</span>
                            {editable && (
                              <button
                                className="link-btn sc-group-row__add"
                                onClick={() => setClassModal({ cls: null, defaults: { campusId, ageGroupId: g.id } })}
                              >
                                <Plus size={14} /> Thêm lớp {g.shortName}
                              </button>
                            )}
                          </td>
                        </tr>,
                        ...rows.map((c) => (
                          <tr key={c.id}>
                            <td className="fw-600">{c.name}</td>
                            {principal && <td>{md.campusById(c.campusId)?.shortName}</td>}
                            <td>{roomOf(c)}</td>
                            <td className="center nowrap">
                              <span className="row" style={{ gap: 4, justifyContent: 'center' }}>
                                <Users size={14} className="muted" /> {c.childCount}/{c.capacity}
                              </span>
                            </td>
                            <td>{md.userById(c.homeroomTeacherId)?.fullName || <span className="muted">Chưa phân công</span>}</td>
                            <td className="text-sm sc-wrap">{teacherNames(c.teacherIds) || <span className="muted">—</span>}</td>
                            {editable && (
                              <td className="right nowrap">
                                <button
                                  className="icon-btn"
                                  title="Sửa"
                                  aria-label={`Sửa ${c.name}`}
                                  onClick={() => setClassModal({ cls: c, defaults: null })}
                                >
                                  <Pencil size={17} />
                                </button>
                                <button
                                  className="icon-btn"
                                  title="Xóa"
                                  aria-label={`Xóa ${c.name}`}
                                  onClick={() => setRemoving({ kind: 'class', item: c })}
                                >
                                  <Trash2 size={17} />
                                </button>
                              </td>
                            )}
                          </tr>
                        )),
                      ];
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <ClassFormModal
        open={!!classModal}
        onClose={closeClassModal}
        cls={classModal?.cls}
        defaults={classModal?.defaults}
        schoolYear={yearId}
        campuses={md.campuses}
        ageGroups={ageGroups}
        locations={md.locations}
        existing={classes}
      />
      <AgeGroupFormModal open={!!groupModal} onClose={closeGroupModal} group={groupModal?.group} existing={ageGroups} />
      <ConfirmationModal
        open={!!removing}
        title={removing?.kind === 'class' ? 'Xóa lớp' : 'Xóa nhóm tuổi'}
        message={
          removing && (
            <>
              Xóa {removing.kind === 'class' ? 'lớp' : 'nhóm tuổi'} <b>{removing.item.name}</b>? Bản ghi đang có trẻ hoặc dữ liệu liên quan
              sẽ không xóa được.
            </>
          )
        }
        confirmLabel={removing?.kind === 'class' ? 'Xóa lớp' : 'Xóa nhóm tuổi'}
        danger
        onConfirm={confirmRemove}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
