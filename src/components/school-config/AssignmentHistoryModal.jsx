import { useState } from 'react';
import { History } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { getClassTeacherHistory, getTeamLeaderHistory } from '@/services/school-config/schoolConfigService';
import { formatDate, formatDateTime } from '@/utils/format';

const PAGE_SIZE = 10;

/**
 * Lịch sử phân công của một lớp (giáo viên) hoặc một nhóm tuổi (tổ trưởng), mới nhất trước.
 * target: { kind: 'class', id, name } | { kind: 'leader', id, name, schoolYear }
 */
export function AssignmentHistoryModal({ target, onClose }) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () => (target.kind === 'class' ? getClassTeacherHistory(target.id, user) : getTeamLeaderHistory(target.id, target.schoolYear, user)),
    [target.kind, target.id, target.schoolYear],
  );
  const rows = data || [];
  const roleOf = (h) => (target.kind === 'leader' ? 'Tổ trưởng' : h.homeroom ? 'GVCN' : 'Giáo viên');

  return (
    <Modal open size="lg" title={`Lịch sử phân công – ${target.name}`} onClose={onClose}>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="Chưa có phân công" />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th>Giáo viên</th>
                  <th>Vai trò</th>
                  <th>Từ ngày</th>
                  <th>Đến ngày</th>
                  <th>Người phân công</th>
                  <th>Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {paginate(rows, page, PAGE_SIZE).map((h) => (
                  <tr key={h.id}>
                    <td className="fw-600">{h.fullName || h.userId}</td>
                    <td>{roleOf(h)}</td>
                    <td>{h.validFrom ? formatDate(h.validFrom) : '—'}</td>
                    <td>{h.current ? <span className="chip chip--teal">Đang phụ trách</span> : formatDate(h.validTo)}</td>
                    <td>{h.assignedByName || '—'}</td>
                    <td className="nowrap">{h.assignedAt ? formatDateTime(h.assignedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > PAGE_SIZE && (
            <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} unit="lần phân công" />
          )}
        </>
      )}
    </Modal>
  );
}
