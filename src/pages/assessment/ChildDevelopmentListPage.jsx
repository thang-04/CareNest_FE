import { useMemo, useState } from 'react';
import { RotateCcw, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useDevelopmentChildren } from '@/hooks/assessment/useAssessment';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { clickableRowProps } from '@/utils/clickableRow';
import { useNavigate } from 'react-router-dom';
import { ChildNameCell } from '@/components/assessment/ChildNameCell';
import { ageLabel } from '@/models/School';
import { formatDate, normalizeText } from '@/utils/format';
import { isLeader } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** Entry list for #53 (teacher: own classes) and #54 (Principal / Vice Principal: school / campus). */
export default function ChildDevelopmentListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const leader = isLeader(user);
  const { children, loading, error, reload } = useDevelopmentChildren();
  const [classId, setClassId] = useState('');
  const [keyword, setKeyword] = useState('');
  // Mặc định trẻ đang học; trẻ đã chuyển lớp / nghỉ vẫn mở được hồ sơ cũ (BE trả current = false)
  const [state, setState] = useState('CURRENT');
  const [page, setPage] = useState(1);
  // Lớp lấy từ chính danh sách trẻ trong phạm vi (cùng thứ tự BE trả)
  const classes = useMemo(() => {
    const seen = new Map();
    children.forEach((ch) => seen.has(String(ch.classId)) || seen.set(String(ch.classId), ch.className));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [children]);

  const rows = children
    .filter((ch) => !classId || String(ch.classId) === classId)
    .filter((ch) => !state || (state === 'CURRENT') === (ch.current !== false))
    .filter((ch) => !keyword || normalizeText(`${ch.fullName} ${ch.code || ''}`).includes(normalizeText(keyword)));

  const link = (ch) => (leader ? `/assessment/children/${ch.id}/progress` : `/assessment/children/${ch.id}`);
  const title = leader ? 'Tiến độ phát triển của trẻ' : 'Hồ sơ phát triển của trẻ';
  const filtered = !!(keyword || classId || state !== 'CURRENT');

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
          {/* Lọc lớp chỉ khi có từ 2 lớp (GV một lớp không cần) */}
          {classes.length > 1 && (
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
          )}
          <select
            className="select"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
            aria-label="Tình trạng học"
          >
            <option value="CURRENT">Đang học</option>
            <option value="LEFT">Đã chuyển lớp / nghỉ</option>
            <option value="">Tất cả</option>
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
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={4} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
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
                                setState('CURRENT');
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
                    <tr key={`${ch.id}-${ch.classId}`} className="row-click" {...clickableRowProps(() => navigate(link(ch)))}>
                      <td>
                        <ChildNameCell child={ch} sub={null} />
                      </td>
                      <td className="nowrap">{ch.dateOfBirth ? formatDate(ch.dateOfBirth) : '—'}</td>
                      <td className="nowrap">{ch.dateOfBirth ? ageLabel(ch.dateOfBirth) : '—'}</td>
                      <td>
                        {ch.className || '—'}
                        {ch.current === false && <div className="muted">Đã chuyển lớp / nghỉ</div>}
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
