import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { FilterSelect } from '@/components/education-plan/planUi';
import { DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useAsync } from '@/hooks/useAsync';
import { getClassDocSummaries } from '@/services/education-plan/educationPlanService';
import { ageRangeOptions, sameAgeRange } from '@/models/education-plan/educationPlanConstants';
import { Eye } from '@/components/ui/icons';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { Checkbox } from '@/components/form/Checkbox';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';

const PAGE_SIZE = 10;

// BE EDU-112 (4)–(5): danh sách trước rồi mới vào chi tiết; mỗi dòng một hồ sơ (bản đang hiệu lực hoặc bản cũ của
// kế hoạch tổ trước), kèm các lần ban hành. Người xem thấy gì do BE quyết định.
const KINDS = {
  semester: {
    title: 'Kế hoạch giáo dục chủ đề',
    what: (d) => `Học kỳ ${d.semesterNo} · ${(d.themeIds || []).length} chủ đề`,
    to: (d) => `/education/theme-plans/${d.classId}?hk=${d.semesterNo}&plan=${encodeURIComponent(d.yearPlanId)}`,
    // Bản ban hành của gói học kỳ mở ở trang kế hoạch chủ đề (chủ đề đầu của kỳ), nơi dựng bản xem như file của trường
    themeOf: (d) => (d.themeIds || [])[0],
  },
  dossier: {
    title: 'Kế hoạch giáo dục ngày',
    what: (d) => `Chủ đề ${d.themeNo || ''}: ${d.themeName || '—'}`,
    to: (d) => `/education/day-plans/${d.classId}?theme=${d.themeId}&plan=${encodeURIComponent(d.yearPlanId)}`,
    themeOf: (d) => d.themeId,
  },
};

export default function ClassDocListPage({ kind }) {
  const meta = KINDS[kind];
  const { user, schoolYearId, classes } = useEducationPlan();
  const navigate = useNavigate();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);
  const [showOld, setShowOld] = useState(false);
  const groupClasses = classes.filter((c) => !ageGroupId || sameAgeRange(c.ageGroupId, ageGroupId));
  const scopedClassId = groupClasses.some((c) => c.id === classId) ? classId : '';
  const classIds = scopedClassId ? [scopedClassId] : ageGroupId ? groupClasses.map((c) => c.id) : [];
  const docs = useAsync(
    () => getClassDocSummaries(schoolYearId, user, { kinds: [kind], classIds, currentOnly: !showOld, page: page - 1, size: PAGE_SIZE }),
    [user.id, schoolYearId, kind, page, showOld, classIds.join(',')],
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
            <label className="row gap-2 field">
              <Checkbox checked={showOld} onChange={(e) => pick(setShowOld)(e.target.checked)} />
              <span>Xem cả bản cũ</span>
            </label>
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
          <DataTable
            className="ga-plan-table ga-list-table"
            rows={items}
            onRowClick={(d) => navigate(meta.to(d))}
            columns={[
              { key: 'class', header: 'Lớp', className: 'w-110 nowrap', render: (d) => classOf(d.classId)?.name || '—' },
              {
                key: 'what',
                header: 'Nội dung',
                render: (d) => (
                  <>
                    <div className="ga-cell-title">{meta.what(d)}</div>
                    {d.yearPlanVersion != null && <div className="ga-cell-sub">Theo kế hoạch tổ phiên bản {d.yearPlanVersion}</div>}
                  </>
                ),
              },
              {
                key: 'version',
                header: 'Phiên bản',
                className: 'center nowrap',
                render: (d) => (
                  <>
                    <div>{d.dossierVersion ?? d.version ?? '—'}</div>
                    <div className="ga-cell-sub">{d.superseded ? 'Bản cũ' : 'Đang hiệu lực'}</div>
                  </>
                ),
              },
              {
                key: 'releases',
                header: 'Các lần ban hành',
                className: 'min-w-150',
                render: (d) =>
                  (d.releases || []).length
                    ? d.releases.map((r, i) => (
                        <div key={r.id} className="ga-cell-sub">
                          {meta.themeOf(d) ? (
                            <Link
                              to={`/education/class/${d.classId}/themes/${meta.themeOf(d)}?plan=${encodeURIComponent(d.yearPlanId)}&release=${r.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Lần {i + 1}
                            </Link>
                          ) : (
                            `Lần ${i + 1}`
                          )}{' '}
                          · {fmtDate(r.releasedAt)}
                          {r.approvedBy ? ` · ${r.approvedBy}` : ''}
                        </div>
                      ))
                    : '—',
              },
              {
                key: 'status',
                header: 'Trạng thái',
                className: 'center nowrap',
                render: (d) => <EduStatusBadge status={d.status} doc={d} />,
              },
              { key: 'deadline', header: 'Hạn', className: 'center nowrap', render: (d) => <DeadlineBadge doc={d} /> },
              {
                key: 'actions',
                header: 'Thao tác',
                className: 'cell--actions',
                render: (d) => (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    icon={Eye}
                    className="nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(meta.to(d));
                    }}
                  >
                    Xem
                  </Button>
                ),
              },
            ]}
          />
        )}
        {total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} unit="hồ sơ" />}
      </Card>
    </div>
  );
}
