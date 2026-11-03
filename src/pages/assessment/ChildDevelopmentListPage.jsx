import { useMemo, useState } from 'react';
import { RotateCcw, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useDevelopmentChildren } from '@/hooks/assessment/useAssessment';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { RowActions } from '@/components/ui/RowActions';
import { ChildNameCell } from '@/components/assessment/ChildNameCell';
import { ageLabel } from '@/models/School';
import { formatDate, normalizeText } from '@/utils/format';
import { isLeader } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** Entry list for #53 (teacher: own classes) and #54 (Principal / Vice Principal: school / campus). */
export default function ChildDevelopmentListPage() {
  const { user } = useAuth();
  const leader = isLeader(user);
  const { children, loading, error, reload } = useDevelopmentChildren();
  const [classId, setClassId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  // Lớp lấy từ chính danh sách trẻ trong phạm vi (cùng thứ tự BE trả)
  const classes = useMemo(() => {
    const seen = new Map();
    children.forEach((ch) => seen.has(String(ch.classId)) || seen.set(String(ch.classId), ch.className));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [children]);

  const rows = children
    .filter((ch) => !classId || String(ch.classId) === classId)
    .filter((ch) => !keyword || normalizeText(`${ch.fullName} ${ch.code || ''}`).includes(normalizeText(keyword)));

  const link = (ch) => (leader ? `/assessment/children/${ch.id}/progress` : `/assessment/children/${ch.id}`);
  const title = leader ? 'Tiến độ phát triển của trẻ' : 'Hồ sơ phát triển của trẻ';
  const filtered = !!(keyword || classId);

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.children)} />
      <h1 className="page__title">{title}</h1>
      <div className="card">
        <div className="filter-bar">
          <SearchSubmit
            className="flex-1"
            value={keyword}
            placeholder="Tìm tên trẻ..."
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
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Ngày sinh</th>
                  <th>Tuổi</th>
                  <th>Lớp</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon={Users}
                        title={filtered ? 'Không tìm thấy trẻ' : leader ? 'Chưa có trẻ trong phạm vi' : 'Lớp bạn phụ trách chưa có trẻ'}
                        description={
                          filtered
                            ? 'Thử đổi từ khóa hoặc lớp.'
                            : leader
                              ? 'Năm học đang chọn chưa có trẻ được xếp lớp.'
                              : 'Bạn chưa được phân công lớp ở năm học đang chọn, hoặc lớp chưa có trẻ.'
                        }
                        action={
                          filtered && (
                            <button
                              className="btn"
                              onClick={() => {
                                setKeyword('');
                                setClassId('');
                                setPage(1);
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
                      <td>
                        <ChildNameCell child={ch} sub={null} />
                      </td>
                      <td className="nowrap">{ch.dateOfBirth ? formatDate(ch.dateOfBirth) : '—'}</td>
                      <td className="nowrap">{ch.dateOfBirth ? ageLabel(ch.dateOfBirth) : '—'}</td>
                      <td>{ch.className || '—'}</td>
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
