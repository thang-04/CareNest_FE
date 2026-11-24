import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { FilterSelect } from '@/components/education-plan/planUi';
import { DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useAsync } from '@/hooks/useAsync';
import { getClassDocSummaries } from '@/services/education-plan/educationPlanService';
import { ageRangeOptions, sameAgeRange } from '@/models/education-plan/educationPlanConstants';
import { clickableRowProps } from '@/utils/clickableRow';
import { Eye } from '@/components/ui/icons';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';

const PAGE_SIZE = 10;

// BE EDU-112 (4)–(5): danh sách trước rồi mới vào chi tiết; mỗi dòng một hồ sơ (bản đang hiệu lực hoặc bản cũ của
// kế hoạch tổ trước), kèm các lần ban hành. Người xem thấy gì do BE quyết định.
const KINDS = {
  semester: {
    title: 'Kế hoạch giáo dục chủ đề',
    what: (d) => `Học kỳ ${d.semesterNo} · ${(d.themeIds || []).length} chủ đề`,
    to: (d) => `/education/theme-plans/${d.classId}?hk=${d.semesterNo}&plan=${encodeURIComponent(d.yearPlanId)}`,
  },
  dossier: {
    title: 'Kế hoạch giáo dục ngày',
    what: (d) => `Chủ đề ${d.themeNo || ''}: ${d.themeName || '—'}`,
    to: (d) => `/education/day-plans/${d.classId}?theme=${d.themeId}&plan=${encodeURIComponent(d.yearPlanId)}`,
  },
};

export default function ClassDocListPage({ kind }) {
  const meta = KINDS[kind];
  const { user, schoolYearId, classes } = useEducationPlan();
  const navigate = useNavigate();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const groupClasses = classes.filter((c) => !ageGroupId || sameAgeRange(c.ageGroupId, ageGroupId));
  const scopedClassId = groupClasses.some((c) => c.id === classId) ? classId : '';
  const classIds = scopedClassId ? [scopedClassId] : ageGroupId ? groupClasses.map((c) => c.id) : [];
  const docs = useAsync(
    () => getClassDocSummaries(schoolYearId, user, { kinds: [kind], classIds, page: page - 1, size: PAGE_SIZE }),
    [user.id, schoolYearId, kind, page, classIds.join(',')],
    { enabled: !!schoolYearId && !(ageGroupId && !classIds.length), refreshOnDataChange: true },
  );
  const items = docs.data?.items || [];
  const total = docs.data?.totalElements || 0;
  const classOf = (id) => classes.find((c) => c.id === id);
  const pick = (set) => (value) => {
    set(value);
    setPage(1);
  };

  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: meta.title }]} title={meta.title} />
        <div className="card mb-16">
          <div className="filter-bar">
            <FilterSelect
              label="Nhóm tuổi"
              value={ageGroupId}
              onChange={pick(setAgeGroupId)}
              options={[{ value: '', label: 'Tất cả' }, ...ageRangeOptions().map((g) => ({ value: String(g.id), label: g.name }))]}
            />
            <FilterSelect
              label="Lớp"
              value={scopedClassId}
              onChange={pick(setClassId)}
              options={[{ value: '', label: 'Tất cả' }, ...groupClasses.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
        </div>
      </div>
      <Card bodyClass={null}>
        {docs.loading ? (
          <LoadingState />
        ) : docs.error ? (
          <ErrorState error={docs.error} onRetry={() => docs.reload()} />
        ) : !items.length ? (
          <EmptyState title={`Chưa có ${meta.title.toLowerCase()}`} />
        ) : (
          <div className="table-wrap">
            <table className="table ga-plan-table ga-list-table">
              <thead>
                <tr>
                  <th className="w-110">Lớp</th>
                  <th>Nội dung</th>
                  <th className="center">Phiên bản</th>
                  <th className="min-w-150">Các lần ban hành</th>
                  <th className="center">Trạng thái</th>
                  <th className="center">Hạn</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id} className="row-click" {...clickableRowProps(() => navigate(meta.to(d)))}>
                    <td className="nowrap">{classOf(d.classId)?.name || '—'}</td>
                    <td>
                      <div className="ga-cell-title">{meta.what(d)}</div>
                      {d.yearPlanVersion != null && <div className="ga-cell-sub">Theo kế hoạch tổ phiên bản {d.yearPlanVersion}</div>}
                    </td>
                    <td className="center nowrap">
                      <div>{d.dossierVersion ?? d.version ?? '—'}</div>
                      <div className="ga-cell-sub">{d.superseded ? 'Bản cũ' : 'Đang hiệu lực'}</div>
                    </td>
                    <td>
                      {(d.releases || []).length
                        ? d.releases.map((r, i) => (
                            <div key={r.id} className="ga-cell-sub">
                              Lần {i + 1} · {fmtDate(r.releasedAt)}
                              {r.approvedBy ? ` · ${r.approvedBy}` : ''}
                            </div>
                          ))
                        : '—'}
                    </td>
                    <td className="center nowrap">
                      <EduStatusBadge status={d.status} doc={d} />
                    </td>
                    <td className="center nowrap">
                      <DeadlineBadge doc={d} />
                    </td>
                    <td className="cell--actions">
                      <button
                        type="button"
                        className="btn btn--sm btn--outline-primary nowrap"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(meta.to(d));
                        }}
                      >
                        <Eye size={16} aria-hidden /> Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} unit="hồ sơ" />}
      </Card>
    </div>
  );
}
