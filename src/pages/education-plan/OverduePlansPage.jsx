import { Button, SelectField } from '@/components';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, YearPlanStatusBadge, fmtDate, fmtDateTime } from '@/components/education-plan/eduUi';
import { ExtendDeadlineModal } from '@/components/education-plan/DeadlineWidgets';
import { FilterMore } from '@/components/ui/FilterMore';
import { Eye } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { usePolling } from '@/hooks/usePolling';
import { useAsync } from '@/hooks/useAsync';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { getOverdueBoard } from '@/services/education-plan/educationPlanService';
import { ageRangeOptions, sameAgeRange } from '@/models/education-plan/educationPlanConstants';
import { planRoute } from '@/models/education-plan/planLevel.mjs';
import { OVERDUE_KIND_LABEL } from '@/models/education-plan/overdue.mjs';

const EMPTY_FILTER = { ageGroupId: '', classId: '', kind: '', semesterNo: '' };
const PAGE_SIZE = 5;

// Xem chỉ đọc trên trang chi tiết có sẵn; ?overdue=1 cho Hiệu trưởng đọc bản chưa ban hành
const viewPathOf = (r) => {
  if (r.planId) return `${planRoute(r.doc)}/${r.planId}?overdue=1`;
  const plan = encodeURIComponent(r.doc.yearPlanId);
  return r.kind === 'semester'
    ? `/education/theme-plans/${r.classId}?hk=${r.doc.semesterNo}&plan=${plan}&overdue=1`
    : `/education/day-plans/${r.classId}?theme=${r.doc.themeId}&plan=${plan}&overdue=1`;
};

/**
 * Kế hoạch quá hạn (spec 005 FR-021a, chỉ Hiệu trưởng): tài liệu chưa ban hành đã tới hạn của cả năm, tổ và lớp; tích
 * nhiều dòng rồi mở hạn với một lý do + hạn mới chung (theo cách "Grant extension" của Moodle). Trang chi tiết không có nút mở.
 */
export default function OverduePlansPage() {
  const { user, schoolYearId } = useEducationPlan();
  // Chọn dòng và hộp mở hạn thuộc lần xem này, kể cả khi đổi A → B → A.
  return <OverduePlansForYear key={JSON.stringify([user.id, schoolYearId])} schoolYearId={schoolYearId} />;
}

function OverduePlansForYear({ schoolYearId }) {
  const id = useId();
  const { user, classes, actOnClassDoc, unlockGoal } = useEducationPlan();
  const [tab, setTab] = useState('overdue');
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  // edu-list-paging (Tiền 25/11/2026): BE ghép, lọc, phân trang 5 hồ sơ/trang; đếm tab và học kỳ BE trả kèm
  const board = useAsync(
    () => getOverdueBoard(user, schoolYearId, { tab, ...filter, page: page - 1, size: PAGE_SIZE }),
    [user.id, schoolYearId, tab, JSON.stringify(filter), page],
    { enabled: !!schoolYearId, refreshOnDataChange: true },
  );
  const { rows: rowPage, overdueCount = 0, extendedCount = 0, semesters = [] } = board.data || {};
  const shown = rowPage?.items || [];
  const total = rowPage?.totalElements || 0;
  const [selected, setSelected] = useState(() => new Set());
  const [target, setTarget] = useState(null);
  const [errors, setErrors] = useState({});
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  usePolling(() => board.reload({ silent: true }), { enabled: !!schoolYearId });

  // Trang vượt số trang sau khi mở hạn (dòng rời tab) ⇒ về trang cuối
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (board.data && page > lastPage) setPage(lastPage);
  }, [board.data, page, lastPage]);
  const count = (t) => (t === 'overdue' ? overdueCount : extendedCount);
  const groups = ageRangeOptions();
  const groupClasses = classes.filter((c) => filter.ageGroupId && sameAgeRange(c.ageGroupId, filter.ageGroupId));
  // Chọn dòng chỉ trong trang đang xem; đổi lọc/tab về trang 1
  const setF = (patch) => {
    setFilter((f) => ({ ...f, ...patch }));
    setPage(1);
    setSelected(new Set());
  };
  const picked = shown.filter((r) => selected.has(r.key));
  const allPicked = shown.length > 0 && picked.length === shown.length;
  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Gọi mở hạn có sẵn lần lượt từng tài liệu; dòng lỗi giữ lại kèm lý do chữ đỏ
  const extend = async ({ note, deadline }) => {
    const failed = {};
    for (const r of target) {
      let message = '';
      // EDU-109 (9): một thao tác Mở hạn cho cả quá hạn gửi lẫn duyệt
      const ok = r.planId
        ? await unlockGoal(r.planId, { note, deadline })
        : await actOnClassDoc(r.kind, r.docKey, { action: 'extend', note, deadline }, user, {
            version: r.version,
            onError: (err) => (message = err.message),
          });
      if (!ok) failed[r.key] = message || 'Không mở hạn được';
    }
    if (active.current) {
      setErrors(failed);
      setSelected(new Set(Object.keys(failed)));
      setTarget(null);
      board.reload({ silent: true });
    }
  };

  const overdueTab = tab === 'overdue';
  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch quá hạn' }]} title="Kế hoạch quá hạn" />
        <div className="card mb-16 ga-overdue-filters">
          <div className="filter-bar">
            <div className="field">
              <label className="field__label" htmlFor={`${id}-deadline-status`}>
                Trạng thái hạn
              </label>
              <SelectField
                id={`${id}-deadline-status`}
                value={tab}
                onChange={(e) => {
                  setTab(e.target.value);
                  setPage(1);
                  setSelected(new Set());
                }}
              >
                <option value="overdue">Đang quá hạn ({count('overdue')})</option>
                <option value="extended">Đã mở hạn ({count('extended')})</option>
              </SelectField>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-age`}>
                Nhóm tuổi
              </label>
              <select
                id={`${id}-age`}
                className="select"
                value={filter.ageGroupId}
                onChange={(e) => setF({ ageGroupId: e.target.value, classId: '' })}
              >
                <option value="">Tất cả</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-class`}>
                Lớp
              </label>
              <select
                id={`${id}-class`}
                className="select"
                value={filter.classId}
                disabled={!filter.ageGroupId}
                onChange={(e) => setF({ classId: e.target.value })}
              >
                <option value="">Tất cả</option>
                {groupClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-bar__end">
              <FilterMore count={[filter.kind, filter.semesterNo].filter(Boolean).length}>
                <div className="field">
                  <label className="field__label" htmlFor={`${id}-kind`}>
                    Loại hồ sơ
                  </label>
                  <select id={`${id}-kind`} className="select" value={filter.kind} onChange={(e) => setF({ kind: e.target.value })}>
                    <option value="">Tất cả</option>
                    {Object.entries(OVERDUE_KIND_LABEL).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`${id}-hk`}>
                    Học kỳ
                  </label>
                  <select
                    id={`${id}-hk`}
                    className="select"
                    value={filter.semesterNo}
                    onChange={(e) => setF({ semesterNo: e.target.value })}
                  >
                    <option value="">Tất cả</option>
                    {semesters.map((n) => (
                      <option key={n} value={n}>
                        Học kỳ {n}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterMore>
            </div>
          </div>
        </div>
      </div>
      <Card bodyClass={null}>
        {((overdueTab && shown.length > 0) || Object.keys(errors).length > 0) && (
          <div className="ga-overdue-actions">
            {overdueTab && shown.length > 0 && (
              <div className="row gap-2">
                <span className="muted text-sm" role="status">
                  Đã chọn {picked.length} kế hoạch
                </span>
                <Button
                  variant="outline-primary"
                  size="sm"
                  data-testid="overdue-plans-extend-selected"
                  disabled={!picked.length}
                  onClick={() => setTarget(picked)}
                >
                  Mở hạn{picked.length ? ` (${picked.length})` : ''}
                </Button>
              </div>
            )}
            {Object.keys(errors).length > 0 && (
              <p className="field__error" role="alert">
                {Object.keys(errors).length} tài liệu chưa mở hạn được, xem lý do ở từng dòng.
              </p>
            )}
          </div>
        )}
        {board.error ? (
          <ErrorState error={board.error} onRetry={board.reload} />
        ) : board.initialLoading ? (
          <LoadingState />
        ) : shown.length === 0 ? (
          <EmptyState title={overdueTab ? 'Chưa có kế hoạch quá hạn' : 'Chưa mở hạn kế hoạch nào'} />
        ) : (
          <div className="ga-overdue-table">
            <div className="table-wrap">
              <table className="table table--grid">
                <thead>
                  <tr>
                    {overdueTab && (
                      <th className="center">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả"
                          checked={allPicked}
                          onChange={() => setSelected(allPicked ? new Set() : new Set(shown.map((r) => r.key)))}
                        />
                      </th>
                    )}
                    <th>Lớp</th>
                    <th>Loại</th>
                    <th>Tên</th>
                    <th>{overdueTab ? 'Hạn' : 'Đã mở hạn tới'}</th>
                    {!overdueTab && <th>Người mở · lý do</th>}
                    <th className="center">Trạng thái</th>
                    <th className="cell--actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.key}>
                      {overdueTab && (
                        <td className="center">
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${r.title}`}
                            checked={selected.has(r.key)}
                            onChange={() => toggle(r.key)}
                          />
                        </td>
                      )}
                      <td>{r.className}</td>
                      <td>{OVERDUE_KIND_LABEL[r.kind]}</td>
                      <td>
                        <div className="fw-600">
                          {r.title}
                          {errors[r.key] && <p className="field__error">{errors[r.key]}</p>}
                        </div>
                      </td>
                      <td>{fmtDate(overdueTab ? r.deadline : r.extension?.deadline)}</td>
                      {!overdueTab && (
                        <td>
                          {[r.extension?.by, r.extension?.at && fmtDateTime(r.extension.at), r.extension?.note]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                      )}
                      <td className="center">
                        {r.planId ? (
                          <YearPlanStatusBadge status={r.status} doc={r.doc} />
                        ) : (
                          <EduStatusBadge status={r.status} doc={r.doc} />
                        )}
                      </td>
                      <td className="cell--actions">
                        <div className="row gap-2">
                          <Link className="btn btn--sm btn--outline-primary" data-testid="overdue-plans-view" to={viewPathOf(r)}>
                            <Eye size={16} aria-hidden /> Xem
                          </Link>
                          {overdueTab && (
                            <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setTarget([r])}>
                              Mở hạn
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > PAGE_SIZE && (
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={(p) => {
                  setPage(p);
                  setSelected(new Set());
                }}
                unit="hồ sơ"
              />
            )}
          </div>
        )}
      </Card>
      {target && (
        <ExtendDeadlineModal
          title={target.length > 1 ? `Mở hạn ${target.length} kế hoạch` : `Mở hạn: ${target[0].title}`}
          onClose={() => setTarget(null)}
          onConfirm={extend}
        />
      )}
    </div>
  );
}
