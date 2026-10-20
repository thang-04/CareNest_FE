import { useMemo, useState } from 'react';
import { LineChart, RotateCcw, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useChildren } from '@/hooks/useSchool';
import { useAssessmentClasses } from '@/hooks/assessment/useAssessment';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { RowActions } from '@/components/ui/RowActions';
import { ChildNameCell } from '@/components/assessment/ChildNameCell';
import { ageLabel, GENDER_LABELS } from '@/models/School';
import { normalizeText } from '@/utils/format';
import { isLeader } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** Entry list for #53 (teacher: own classes) and #54 (Principal / Vice Principal: school / campus). */
export default function ChildDevelopmentListPage() {
  const { user } = useAuth();
  const leader = isLeader(user);
  const { classes, loading: classesLoading, error: classesError } = useAssessmentClasses();
  const [classId, setClassId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const { children, loading, error, reload } = useChildren({ status: 'ACTIVE' });
  const classIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes]);
  const className = (id) => classes.find((c) => c.id === id)?.name || '—';

  const rows = children
    .filter((ch) => classIds.has(ch.classId))
    .filter((ch) => !classId || ch.classId === classId)
    .filter((ch) => !keyword || normalizeText(`${ch.fullName} ${ch.code}`).includes(normalizeText(keyword)))
    .sort((a, b) => className(a.classId).localeCompare(className(b.classId)) || a.fullName.localeCompare(b.fullName));

  const link = (ch) => (leader ? `/assessment/children/${ch.id}/progress` : `/assessment/children/${ch.id}`);
  const title = leader ? 'Tiến độ phát triển của trẻ' : 'Hồ sơ phát triển của trẻ';

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.children)} />
      <h1 className="page__title">{title}</h1>
      <div className="alert alert--info mb-16">
        <LineChart size={18} />
        <div>
          {leader
            ? 'Chọn một trẻ để xem các đánh giá hằng ngày và đánh giá định kỳ đã được giáo viên xác nhận.'
            : 'Chọn một trẻ của lớp bạn phụ trách để xem toàn bộ hồ sơ phát triển theo thời gian.'}
        </div>
      </div>
      <div className="card">
        <div className="filter-bar">
          <SearchSubmit
            className="flex-1"
            value={keyword}
            placeholder="Tìm tên hoặc mã trẻ..."
            label="Tìm trẻ"
            onSearch={(text) => {
              setKeyword(text);
              setPage(1);
            }}
          />
          <select
            className="select"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
            aria-label="Lớp"
          >
            <option value="">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {error || classesError ? (
          <ErrorState error={error || classesError} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã trẻ</th>
                  <th>Họ tên</th>
                  <th>Giới tính</th>
                  <th>Tuổi</th>
                  <th>Lớp</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading || classesLoading ? (
                  <SkeletonRows rows={5} cols={6} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={Users}
                        title={classes.length ? 'Không tìm thấy trẻ' : 'Bạn chưa được phân công lớp'}
                        description={classes.length ? 'Thử đổi từ khóa hoặc lớp.' : 'Liên hệ Hiệu trưởng để được phân công lớp.'}
                        action={
                          classes.length > 0 &&
                          (keyword || classId) && (
                            <button
                              className="btn"
                              onClick={() => {
                                setKeyword('');
                                setClassId('');
                              }}
                            >
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, page).map((ch) => (
                    <tr key={ch.id}>
                      <td className="fw-600 text-primary">{ch.code}</td>
                      <td>
                        <ChildNameCell child={ch} sub={null} />
                      </td>
                      <td>{GENDER_LABELS[ch.gender]}</td>
                      <td className="nowrap">{ageLabel(ch.dateOfBirth)}</td>
                      <td>{className(ch.classId)}</td>
                      <td className="cell--actions">
                        <RowActions view={{ to: link(ch), label: leader ? 'Xem tiến độ' : 'Xem hồ sơ' }} name={ch.fullName} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="trẻ" />}
      </div>
    </div>
  );
}
