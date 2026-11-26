import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Users, ArrowLeft } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildRecords, useClassOptions, usePlacementClasses, useYearHolidays } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Tabs } from '@/components/ui/Tabs';
import { clickableRowProps } from '@/utils/clickableRow';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ActiveYearNotice } from '@/components/children/ActiveYearNotice';
import { YearLockedNotice } from '@/components/children/YearLockedNotice';
import { ClassPlacementFields } from '@/components/children/ClassPlacementFields';
import { cancelScheduledPlacement, placeChild } from '@/services/children/childrenService';
import { CHILD_STATUS, ageLabel } from '@/models/School';
import { formatDate, normalizeText, todayInput } from '@/utils/format';
import {
  earliestPlacementDate,
  firstSchoolDay,
  hasScheduledTransfer,
  isNotStarted,
  notStartedLabel,
  placementDateError,
  scheduledTransferLabel,
} from '@/utils/children/startDate';
import { canOpenPlacement, canPlaceChild, childCampusesOf } from '@/utils/children/childrenPermissions';
import { suggestAgeGroupId } from '@/utils/children/childrenHelpers';
import { classFullness } from '@/utils/children/placementClasses';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const TABS = [
  { key: CHILD_STATUS.PENDING_PLACEMENT, label: 'Chờ xếp lớp' },
  { key: CHILD_STATUS.ACTIVE, label: 'Chuyển lớp' },
];

export default function ClassPlacementPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { schoolYear, schoolYears, activeYear, yearReadOnly, yearLocked, setSchoolYear } = useSchoolYear();
  // Xếp, chuyển lớp luôn ở năm học đang hoạt động dù header chọn năm khác (user chốt 2026-10-28, Y-3).
  const yearId = activeYear?.id || schoolYear;
  const [params, setParams] = useSearchParams();
  const { children, loading, error, reload } = useChildRecords({ schoolYear: yearId });
  // Nhóm tuổi của năm học đang hoạt động (BE /school-structure hoặc mock); năm sinh so với ngày bắt đầu năm học
  const { ageGroups } = useClassOptions(yearId);
  const yearStart = activeYear?.startDate || yearId;
  const [tab, setTab] = useState(CHILD_STATUS.PENDING_PLACEMENT);
  const [keyword, setKeyword] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [classId, setClassId] = useState('');
  const [reason, setReason] = useState('');
  // G94-180/CHD-14: ngày vào lớp / ngày chuyển lớp (ngày tương lai = lịch chuyển)
  const [effectiveDate, setEffectiveDate] = useState('');
  const [dateTouched, setDateTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { holidays } = useYearHolidays(yearId);
  const today = todayInput();

  const selectedId = params.get('childId') || '';
  const selected = children.find((c) => c.id === selectedId) || null;
  const suggested = selected ? suggestAgeGroupId(selected.dateOfBirth, yearStart, ageGroups) : '';
  // Sĩ số tính theo ngày vào lớp, bỏ chính trẻ này (G94-180/CHD-14)
  const {
    classes,
    reload: reloadClasses,
    from: classesFrom,
  } = usePlacementClasses(undefined, { from: effectiveDate, childId: selected?.id });

  // Lớp đang chọn thành đã đủ sau khi đổi ngày ⇒ bỏ chọn, báo ở ô Lớp
  useEffect(() => {
    const picked = classes.find((c) => c.id === classId);
    if (!picked || !classFullness(picked).full) return;
    setClassId('');
    setErrors((e) => ({ ...e, classId: `${picked.name} đã đủ từ ${classesFrom ? formatDate(classesFrom) : 'hôm nay'}. Chọn lớp khác.` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi số lớp tải lại
  }, [classes]);

  useEffect(() => {
    if (!selected) return;
    setTab(selected.status === CHILD_STATUS.PENDING_PLACEMENT ? CHILD_STATUS.PENDING_PLACEMENT : CHILD_STATUS.ACTIVE);
    setAgeGroupId(selected.ageGroupId || suggestAgeGroupId(selected.dateOfBirth, yearStart, ageGroups));
    setCampusId(selected.campusId || '');
    setClassId('');
    setReason('');
    setDateTouched(false);
    setErrors({});
    // Only when another child is chosen (or age groups arrive); reloads of the same child keep the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, !!selected, ageGroups.length]);

  // Ngày mặc định: mốc sớm nhất (hôm nay; xếp lần đầu không trước ngày bắt đầu đi học), lùi tới ngày học gần nhất
  useEffect(() => {
    if (selected && !dateTouched) setEffectiveDate(firstSchoolDay(earliestPlacementDate(selected, today), holidays, activeYear?.endDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tính lại khi đổi trẻ hoặc ngày nghỉ tải xong
  }, [selectedId, !!selected, holidays]);

  const list = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    // G94-180/CHD-14: trẻ đã tới ngày bắt đầu đi học mà chưa có lớp lên đầu (cờ startDue do BE tính)
    return children
      .filter((c) => c.status === tab)
      .filter((c) => !kw || normalizeText(`${c.fullName} ${c.code}`).includes(kw))
      .sort((a, b) => Number(!!b.startDue) - Number(!!a.startDue));
  }, [children, tab, keyword]);

  if (!canOpenPlacement(user))
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Xếp lớp')} />
        <h1 className="page__title">Xếp lớp cho trẻ</h1>
        <StatusPage
          kind="403"
          title="Bạn không có quyền xếp lớp"
          description="Chỉ Hiệu trưởng hoặc Phó hiệu trưởng của điểm trường được xếp và chuyển lớp cho trẻ."
        />
      </div>
    );

  // Năm đã kết thúc hoặc năm sắp diễn ra chưa tới ngày mở chuẩn bị (CHD-12): chỉ xem
  if (yearReadOnly || yearLocked)
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Xếp lớp')} />
        <h1 className="page__title">Xếp lớp cho trẻ</h1>
        {yearLocked ? <YearLockedNotice action="Xếp lớp, chuyển lớp" /> : <ActiveYearNotice action="Xếp lớp, chuyển lớp" />}
      </div>
    );

  // Header ở năm sắp diễn ra đã mở chuẩn bị: không hiện bảng năm đang học, xếp lớp năm đó ở màn Xếp lớp năm học mới (user chốt 24/11, Q4=A)
  if (activeYear && schoolYear !== activeYear.id) {
    const headerLabel = schoolYears.find((y) => y.id === schoolYear)?.label || schoolYear;
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Xếp lớp')} />
        <h1 className="page__title">Xếp lớp cho trẻ</h1>
        <EmptyState
          icon={LayoutGrid}
          title={`Xếp lớp năm học ${headerLabel} làm ở màn Xếp lớp năm học mới`}
          description={`Trang này xếp, chuyển lớp trong năm học đang hoạt động ${activeYear.label}.`}
          action={
            <div className="row gap-2">
              <Link className="btn btn--primary" to="/school/placement">
                Mở Xếp lớp năm học mới
              </Link>
              <Button onClick={() => setSchoolYear(activeYear.id)}>Về năm học {activeYear.label}</Button>
            </div>
          }
        />
      </div>
    );
  }

  // Lớp chưa bắt đầu không tính là đang học: đổi lớp đó không cần lý do
  const isTransfer = !!selected?.classId && !isNotStarted(selected);
  const earliest = selected ? earliestPlacementDate(selected, today) : today;
  const later = !!effectiveDate && effectiveDate > today;
  const targetClass = classes.find((c) => c.id === classId);
  // Hiệu trưởng, PHT toàn trường: ô Điểm trường mặc định điểm trường của trẻ; lớp điểm trường khác = chuyển điểm trường.
  const campusOptions = childCampusesOf(user, md.campuses, 'update');
  const pickCampus = campusOptions.length > 1;
  const campusLabel = (id) => md.campusById(id)?.shortName || md.campusById(id)?.name || '';
  const movesCampus = !!selected && !!targetClass && targetClass.campusId !== selected.campusId;
  const targetName = targetClass ? `${targetClass.name}${movesCampus ? ` (${campusLabel(targetClass.campusId)})` : ''}` : '';
  const campusNote = movesCampus ? ' Trẻ chuyển sang điểm trường của lớp mới.' : '';
  const tabCount = (status) => children.filter((c) => c.status === status).length;

  const submit = () => {
    const errs = {};
    if (!classId) errs.classId = 'Chọn lớp cho trẻ';
    if (isTransfer && !reason.trim()) errs.reason = 'Nhập lý do chuyển lớp';
    const dateError = placementDateError(effectiveDate, {
      earliest,
      today,
      yearEnd: activeYear?.endDate,
      holidays,
      transfer: isTransfer,
    });
    if (dateError) errs.effectiveDate = dateError;
    setErrors(errs);
    if (Object.keys(errs).length === 0) setConfirm(true);
  };

  const doPlace = async () => {
    try {
      const child = await placeChild(selected.id, { classId, reason, effectiveDate }, user);
      toast.success(
        later
          ? `${child.fullName} sẽ vào ${targetClass?.name || child.className} từ ${formatDate(effectiveDate)}.`
          : `${child.fullName} đã vào ${child.className}.`,
        isTransfer ? (later ? 'Đã đặt lịch chuyển lớp' : 'Đã chuyển lớp') : 'Đã xếp lớp',
      );
      setConfirm(false);
      setParams({});
      // BE thật không phát sự kiện đổi dữ liệu như mock ⇒ tự tải lại lớp hiện tại của trẻ và sĩ số lớp nguồn, lớp đích
      reload({ silent: true });
      reloadClasses({ silent: true });
    } catch (err) {
      setConfirm(false);
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không xếp được lớp');
    }
  };

  const doCancel = async () => {
    try {
      const child = await cancelScheduledPlacement(selected.id, user);
      toast.success(child.classId ? `${child.fullName} ở lại ${child.className}.` : `${child.fullName} về Chờ xếp lớp.`, 'Đã hủy lịch');
      setConfirmCancel(false);
      setParams({});
      reload({ silent: true });
      reloadClasses({ silent: true });
    } catch (err) {
      setConfirmCancel(false);
      toast.error(err, 'Không hủy được lịch');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Xếp lớp')} />
      <h1 className="page__title">Xếp lớp cho trẻ</h1>
      <ActiveYearNotice action="Xếp lớp, chuyển lớp" />
      <div className="split-2 tr-split">
        <section className="card">
          <Tabs
            items={TABS.map((t) => ({ ...t, count: tabCount(t.key) }))}
            value={tab}
            onChange={setTab}
            ariaLabel="Nhóm trẻ cần xếp lớp"
          />
          <div className="filter-bar">
            <SearchSubmit
              className="flex-1"
              value={keyword}
              placeholder="Tìm theo họ tên hoặc mã trẻ..."
              label="Tìm trẻ"
              onSearch={setKeyword}
            />
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap tr-table-flat tr-scroll-list">
              <table className="table table--grid table--compact">
                <thead>
                  <tr>
                    <th>Trẻ</th>
                    <th>Tuổi</th>
                    <th>Lớp hiện tại</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows rows={4} cols={3} />
                  ) : list.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState
                          icon={Users}
                          title={tab === CHILD_STATUS.PENDING_PLACEMENT ? 'Không có trẻ chờ xếp lớp' : 'Không có trẻ phù hợp'}
                          description={
                            tab === CHILD_STATUS.PENDING_PLACEMENT
                              ? 'Trẻ nhập từ Excel sẽ hiện ở đây để xếp lớp.'
                              : 'Thử tìm với từ khóa khác.'
                          }
                          action={
                            tab === CHILD_STATUS.PENDING_PLACEMENT && (
                              <Link className="btn" to="/children?import=1">
                                Nhập từ Excel
                              </Link>
                            )
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    list.map((c) => (
                      <tr
                        key={c.id}
                        className={`row-click ${c.id === selectedId ? 'row--selected' : ''}`}
                        aria-selected={c.id === selectedId}
                        {...clickableRowProps(() => setParams({ childId: c.id }))}
                      >
                        <td>
                          <span className="fw-600">{c.fullName}</span>
                          <div className="muted text-xs">{c.code}</div>
                          {c.startDue && <StatusBadge tone="orange" size="sm" label="Đã tới ngày đi học, chưa có lớp" />}
                        </td>
                        <td className="nowrap">{ageLabel(c.dateOfBirth)}</td>
                        <td>
                          {c.className || <span className="muted">Chưa xếp</span>}
                          {isNotStarted(c) && <span className="muted text-xs"> ({notStartedLabel(c)})</span>}
                          {hasScheduledTransfer(c) && <div className="text-xs">{scheduledTransferLabel(c)}</div>}
                          {pickCampus && <div className="muted text-xs">{campusLabel(c.campusId)}</div>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card wizard-card">
          {!selected ? (
            <EmptyState icon={LayoutGrid} title="Chọn một trẻ" description="Chọn trẻ ở danh sách bên trái để xếp hoặc chuyển lớp." />
          ) : !canPlaceChild(selected, user) ? (
            <StatusPage
              bare
              kind="403"
              title="Không xếp được lớp cho trẻ này"
              description="Trẻ không thuộc điểm trường của bạn hoặc đã nghỉ học."
              action={null}
            />
          ) : (
            <>
              <h2 className="card__title">
                {isTransfer ? 'Chuyển lớp' : 'Xếp lớp'}: {selected.fullName}
              </h2>
              <p className="muted text-sm mb-12">
                {selected.code} · {ageLabel(selected.dateOfBirth)}
                {selected.className && !isNotStarted(selected) ? ` · đang học ${selected.className}` : ''}
              </p>
              {(hasScheduledTransfer(selected) || isNotStarted(selected)) && (
                <div className="alert alert--info mb-12" role="status">
                  <div className="stack gap-1">
                    <span>
                      {hasScheduledTransfer(selected)
                        ? `${scheduledTransferLabel(selected)}. Tới hết ngày trước đó trẻ vẫn học ${selected.className}.`
                        : `Đã xếp vào ${selected.nextClass.className} ${notStartedLabel(selected)}, lớp chưa bắt đầu.`}{' '}
                      Xếp hoặc chuyển lần nữa sẽ thay lịch này.
                    </span>
                    <span>
                      <Button size="sm" onClick={() => setConfirmCancel(true)}>
                        {hasScheduledTransfer(selected) ? 'Hủy lịch chuyển' : 'Hủy xếp lớp'}
                      </Button>
                    </span>
                  </div>
                </div>
              )}
              <ClassPlacementFields
                classes={classes}
                ageGroupId={ageGroupId}
                onAgeGroupChange={(v) => {
                  setAgeGroupId(v);
                  setClassId('');
                }}
                classId={classId}
                onClassChange={(id) => {
                  setClassId(id);
                  setErrors(({ classId: _c, ...rest }) => rest);
                }}
                suggestedAgeGroupId={suggested}
                ageGroups={ageGroups}
                currentClassId={selected.classId}
                error={errors.classId}
                userById={md.userById}
                campuses={campusOptions}
                campusId={campusId}
                onCampusChange={(id) => {
                  setCampusId(id);
                  setClassId('');
                }}
              />
              <FormField
                label={isTransfer ? 'Ngày chuyển lớp' : 'Ngày vào lớp'}
                required
                error={errors.effectiveDate}
                hint={later ? 'Ngày tương lai: tới hết ngày trước đó trẻ vẫn ở lớp hiện tại.' : undefined}
                className="mt-16"
              >
                <DateInput
                  value={effectiveDate}
                  min={earliest}
                  max={activeYear?.endDate}
                  onChange={(value) => {
                    setEffectiveDate(value);
                    setDateTouched(true);
                    setErrors(({ effectiveDate: _d, ...rest }) => rest);
                  }}
                />
              </FormField>
              {isTransfer && (
                <FormField label="Lý do chuyển lớp" required error={errors.reason} className="mt-16">
                  <textarea
                    className="textarea"
                    rows={2}
                    maxLength={300}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (e.target.value.trim()) setErrors(({ reason: _r, ...rest }) => rest);
                    }}
                  />
                </FormField>
              )}
              <div className="page-actions">
                <Link className="btn" to={`/children/${selected.id}`}>
                  <ArrowLeft size={16} /> Xem hồ sơ
                </Link>
                <button className="btn btn--primary" onClick={submit}>
                  <LayoutGrid size={16} /> {isTransfer ? 'Chuyển lớp' : 'Xếp vào lớp'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      <ConfirmationModal
        open={confirm}
        title={isTransfer ? 'Chuyển lớp cho trẻ?' : 'Xếp lớp cho trẻ?'}
        message={
          selected && targetClass
            ? isTransfer
              ? `${selected.fullName} sẽ rời ${selected.className} và vào ${targetName} từ ${formatDate(effectiveDate)}.${campusNote} Giáo viên lớp cũ và lớp mới được thông báo.`
              : `${selected.fullName} sẽ vào ${targetName} từ ${formatDate(effectiveDate)}.${campusNote} Giáo viên của lớp được thông báo.`
            : ''
        }
        confirmLabel={isTransfer ? 'Chuyển lớp' : 'Xếp vào lớp'}
        onConfirm={doPlace}
        onClose={() => setConfirm(false)}
      />
      <ConfirmationModal
        open={confirmCancel}
        title={hasScheduledTransfer(selected) ? 'Hủy lịch chuyển lớp?' : 'Hủy xếp lớp chưa bắt đầu?'}
        message={
          selected?.nextClass
            ? hasScheduledTransfer(selected)
              ? `${selected.fullName} ở lại ${selected.className}, không chuyển sang ${selected.nextClass.className}.`
              : `${selected.fullName} không vào ${selected.nextClass.className}, về Chờ xếp lớp.`
            : ''
        }
        confirmLabel="Hủy lịch"
        cancelLabel="Giữ lịch"
        danger
        onConfirm={doCancel}
        onClose={() => setConfirmCancel(false)}
      />
    </div>
  );
}
