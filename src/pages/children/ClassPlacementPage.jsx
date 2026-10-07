import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, LayoutGrid, Users, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildRecords, usePlacementClasses } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ClassPlacementFields } from '@/components/children/ClassPlacementFields';
import { placeChild } from '@/services/children/childrenService';
import { CHILD_STATUS, ageLabel } from '@/models/School';
import { normalizeText } from '@/utils/format';
import { canPlaceChild, isVicePrincipal } from '@/utils/children/childrenPermissions';
import { suggestAgeGroupId } from '@/utils/children/childrenHelpers';
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
  const { schoolYear } = useSchoolYear();
  const [params, setParams] = useSearchParams();
  const { children, loading, error, reload } = useChildRecords({ schoolYear });
  const { classes } = usePlacementClasses(schoolYear);
  const [tab, setTab] = useState(CHILD_STATUS.PENDING_PLACEMENT);
  const [keyword, setKeyword] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);

  const selectedId = params.get('childId') || '';
  const selected = children.find((c) => c.id === selectedId) || null;
  const suggested = selected ? suggestAgeGroupId(selected.dateOfBirth, schoolYear) : '';

  useEffect(() => {
    if (!selected) return;
    setTab(selected.status === CHILD_STATUS.PENDING_PLACEMENT ? CHILD_STATUS.PENDING_PLACEMENT : CHILD_STATUS.ACTIVE);
    setAgeGroupId(selected.ageGroupId || suggestAgeGroupId(selected.dateOfBirth, schoolYear));
    setClassId('');
    setReason('');
    setErrors({});
    // Only when another child is chosen; reloads of the same child keep the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, !!selected]);

  const list = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return children.filter((c) => c.status === tab).filter((c) => !kw || normalizeText(`${c.fullName} ${c.code}`).includes(kw));
  }, [children, tab, keyword]);

  if (!isVicePrincipal(user))
    return (
      <div className="page">
        <Breadcrumb items={childrenCrumbs('Xếp lớp')} />
        <h1 className="page__title">Xếp lớp cho trẻ</h1>
        <div className="card">
          <EmptyState
            icon={Lock}
            title="Bạn không có quyền xếp lớp"
            description="Chỉ Phó hiệu trưởng của điểm trường được xếp và chuyển lớp cho trẻ."
          />
        </div>
      </div>
    );

  const isTransfer = !!selected?.classId;
  const targetClass = classes.find((c) => c.id === classId);
  const pendingCount = children.filter((c) => c.status === CHILD_STATUS.PENDING_PLACEMENT).length;

  const submit = () => {
    const errs = {};
    if (!classId) errs.classId = 'Chọn lớp cho trẻ';
    if (isTransfer && !reason.trim()) errs.reason = 'Nhập lý do chuyển lớp';
    setErrors(errs);
    if (Object.keys(errs).length === 0) setConfirm(true);
  };

  const doPlace = async () => {
    try {
      const child = await placeChild(selected.id, { classId, reason }, user);
      toast.success(`${child.fullName} đã vào ${child.className}.`, isTransfer ? 'Đã chuyển lớp' : 'Đã xếp lớp');
      setConfirm(false);
      setParams({});
    } catch (err) {
      setConfirm(false);
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không xếp được lớp');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs('Xếp lớp')} />
      <h1 className="page__title">Xếp lớp cho trẻ</h1>
      <div className="split-2 tr-split">
        <section className="card">
          <div className="tabs" style={{ padding: '6px 16px 0' }} role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`tab ${tab === t.key ? 'tab--active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                {t.key === CHILD_STATUS.PENDING_PLACEMENT && <span className="tab__count">{pendingCount}</span>}
              </button>
            ))}
          </div>
          <div className="filter-bar">
            <label className="search-box" style={{ flex: 1 }}>
              <Search size={17} className="muted" />
              <input
                placeholder="Tìm theo họ tên hoặc mã trẻ..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label="Tìm trẻ"
              />
            </label>
          </div>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap tr-table-flat tr-scroll-list">
              <table className="table table--compact">
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
                              <Link className="btn" to="/children/import">
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
                        onClick={() => setParams({ childId: c.id })}
                      >
                        <td>
                          <button type="button" className="link-btn fw-600" onClick={() => setParams({ childId: c.id })}>
                            {c.fullName}
                          </button>
                          <div className="muted text-xs">{c.code}</div>
                        </td>
                        <td className="nowrap">{ageLabel(c.dateOfBirth)}</td>
                        <td>{c.className || <span className="muted">Chưa xếp</span>}</td>
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
            <EmptyState
              icon={Lock}
              title="Không xếp được lớp cho trẻ này"
              description="Trẻ không thuộc điểm trường của bạn hoặc đã nghỉ học."
            />
          ) : (
            <>
              <h2 className="card__title">
                {isTransfer ? 'Chuyển lớp' : 'Xếp lớp'}: {selected.fullName}
              </h2>
              <p className="muted text-sm mb-12">
                {selected.code} · {ageLabel(selected.dateOfBirth)}
                {selected.className ? ` · đang học ${selected.className}` : ''}
              </p>
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
                currentClassId={selected.classId}
                error={errors.classId}
                userById={md.userById}
              />
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
              ? `${selected.fullName} sẽ rời ${selected.className} và vào ${targetClass.name}. Giáo viên lớp mới được thông báo.`
              : `${selected.fullName} sẽ vào ${targetClass.name}. Giáo viên của lớp được thông báo.`
            : ''
        }
        confirmLabel={isTransfer ? 'Chuyển lớp' : 'Xếp vào lớp'}
        onConfirm={doPlace}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
