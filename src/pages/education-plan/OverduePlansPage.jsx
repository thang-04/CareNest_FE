import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, YearPlanStatusBadge, fmtDate, fmtDateTime } from '@/components/education-plan/eduUi';
import { ExtendDeadlineModal } from '@/components/education-plan/DeadlineWidgets';
import { LoadingState } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { Eye } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { todayIso } from '@/models/education-plan/classPlan';
import { planRoute } from '@/models/education-plan/planLevel.mjs';
import { OVERDUE_KIND_LABEL, filterOverdue, overdueRows } from '@/models/education-plan/overdue.mjs';

const EMPTY_FILTER = { ageGroupId: '', classId: '', kind: '', semesterNo: '' };

const linkOf = (r) =>
  r.planId
    ? `${planRoute(r.doc)}/${r.planId}`
    : r.kind === 'semester'
      ? `/education/theme-plans/${r.classId}?hk=${r.semesterNo}`
      : `/education/day-plans/${r.classId}?theme=${r.doc.themeId}`;

/**
 * Kế hoạch quá hạn (spec 005 FR-021a, chỉ Hiệu trưởng): tài liệu chưa ban hành đã tới hạn của cả năm, tổ và lớp; tích
 * nhiều dòng rồi mở hạn với một lý do + hạn mới chung (theo cách "Grant extension" của Moodle). Trang chi tiết không có nút mở.
 */
export default function OverduePlansPage() {
  const id = useId();
  const { loading, user, goals, semesterPackages, themeDossiers, classes, actOnClassDoc, unlockGoal } = useEducationPlan();
  const [tab, setTab] = useState('overdue');
  const [filter, setFilter] = useState(EMPTY_FILTER);
  const [selected, setSelected] = useState(() => new Set());
  const [target, setTarget] = useState(null);
  const [errors, setErrors] = useState({});

  if (loading) return <LoadingState />;
  const themeNameOf = (d) => goals.find((g) => g.id === d.yearPlanId)?.themes?.find((t) => t.id === d.themeId)?.name || 'Chủ đề';
  const rows = overdueRows({ semesterPackages, themeDossiers, yearPlans: goals, classes, themeNameOf, today: todayIso() });
  const shown = filterOverdue(rows, { tab, ...filter });
  const count = (t) => filterOverdue(rows, { tab: t }).length;
  const groups = AGE_GROUPS.filter((g) => rows.some((r) => r.ageGroupId === String(g.id)));
  const groupClasses = classes.filter((c) => filter.ageGroupId && String(c.ageGroupId) === filter.ageGroupId);
  const semesters = [...new Set(rows.map((r) => r.semesterNo).filter((n) => n != null))].sort();
  const setF = (patch) => {
    setFilter((f) => ({ ...f, ...patch }));
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
      const ok = r.planId
        ? await unlockGoal(r.planId, { note, deadline })
        : await actOnClassDoc(r.kind, r.docKey, { action: 'extend', note, deadline }, user, {
            version: r.version,
            onError: (err) => (message = err.message),
          });
      if (!ok) failed[r.key] = message || 'Không mở hạn được';
    }
    setErrors(failed);
    setSelected(new Set(Object.keys(failed)));
    setTarget(null);
  };

  const overdueTab = tab === 'overdue';
  return (
    <div className="page ga-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch quá hạn' }]} title="Kế hoạch quá hạn" />
      <Tabs
        ariaLabel="Kế hoạch quá hạn"
        value={tab}
        onChange={(key) => {
          setTab(key);
          setSelected(new Set());
        }}
        items={[
          { key: 'overdue', label: 'Đang quá hạn', count: count('overdue') },
          { key: 'extended', label: 'Đã mở hạn', count: count('extended') },
        ]}
      />
      <Card bodyClass={null} className="mt-16">
        <div className="filter-bar">
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
          <div className="field">
            <label className="field__label" htmlFor={`${id}-kind`}>
              Loại
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
            <select id={`${id}-hk`} className="select" value={filter.semesterNo} onChange={(e) => setF({ semesterNo: e.target.value })}>
              <option value="">Tất cả</option>
              {semesters.map((n) => (
                <option key={n} value={n}>
                  Học kỳ {n}
                </option>
              ))}
            </select>
          </div>
          {overdueTab && (
            <button type="button" className="btn btn--primary" disabled={!picked.length} onClick={() => setTarget(picked)}>
              Mở hạn{picked.length ? ` (${picked.length})` : ''}
            </button>
          )}
        </div>
        {Object.keys(errors).length > 0 && (
          <div className="card__body">
            <p className="field__error" role="alert">
              {Object.keys(errors).length} tài liệu chưa mở hạn được, xem lý do ở từng dòng.
            </p>
          </div>
        )}
        {shown.length === 0 ? (
          <EmptyState title={overdueTab ? 'Không có kế hoạch quá hạn' : 'Chưa mở hạn kế hoạch nào'} />
        ) : (
          <div className="card__body">
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
                    <th>{overdueTab ? 'Số ngày quá hạn' : 'Người mở · lý do'}</th>
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
                      <td>
                        {overdueTab
                          ? (r.daysOverdue ?? '—')
                          : [r.extension?.by, r.extension?.at && fmtDateTime(r.extension.at), r.extension?.note]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                      </td>
                      <td className="center">
                        {r.planId ? (
                          <YearPlanStatusBadge status={r.status} doc={r.doc} />
                        ) : (
                          <EduStatusBadge status={r.status} doc={r.doc} />
                        )}
                      </td>
                      <td className="cell--actions">
                        <div className="row gap-2">
                          <Link className="btn btn--sm btn--outline-primary" to={linkOf(r)}>
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
