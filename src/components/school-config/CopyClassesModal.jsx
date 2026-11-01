import { useEffect, useMemo, useState } from 'react';
import { Copy } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolStructure } from '@/hooks/school-config/useSchoolConfig';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { copyClasses } from '@/services/school-config/schoolConfigService';
import { normalizeText } from '@/utils/format';

/**
 * Every other school year can be the copy source (team decision 10/10/2026: not only the previous year).
 * Earlier years first, newest first, so the default is the year right before `target`; later years follow.
 */
export const copySourcesFor = (years, target) => {
  if (!target) return [];
  const others = years.filter((y) => y.id !== target.id);
  const byNewest = (a, b) => b.startDate.localeCompare(a.startDate);
  return [
    ...others.filter((y) => y.startDate < target.startDate).sort(byNewest),
    ...others.filter((y) => y.startDate >= target.startDate).sort(byNewest),
  ];
};

export const copyResultMessage = ({ copied, skipped, withoutRoom = [] }) =>
  `Đã sao chép ${copied.length} lớp${skipped.length ? `, bỏ qua ${skipped.length} lớp đã có trong năm học` : ''}.` +
  (withoutRoom.length
    ? ` ${withoutRoom.length} lớp chưa có phòng (phòng cũ đã được dùng hoặc ngừng sử dụng): ${withoutRoom.join(', ')}.`
    : '');

// Lớp trùng = cùng điểm trường và cùng tên trong năm học đích
const key = (c) => `${c.campusId}|${normalizeText((c.name || '').trim())}`;

/**
 * Copy classes from another school year (SRS 4.1.3 Copy from Previous Year, extended: any year, chosen classes).
 * Copies name, age group, campus, room and capacity – never teachers or children.
 */
export function CopyClassesModal({ open, onClose, target, years }) {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const sources = useMemo(() => copySourcesFor(years, target), [years, target]);
  const [sourceId, setSourceId] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const source = useSchoolStructure(open ? sourceId : '', '');
  const current = useSchoolStructure(open ? target?.id : '', '');

  useEffect(() => {
    if (open) setSourceId(sources[0]?.id || '');
    setError('');
  }, [open, sources]);

  const existing = useMemo(() => new Set((current.structure?.classes || []).map(key)), [current.structure]);
  const rows = useMemo(
    () => (source.structure?.year?.id === sourceId ? source.structure.classes : []).map((c) => ({ ...c, exists: existing.has(key(c)) })),
    [source.structure, sourceId, existing],
  );

  // Mặc định chọn mọi lớp chưa có trong năm học đích; chỉ đặt lại khi đổi năm nguồn, không khi dữ liệu tải lại
  const rowsKey = `${sourceId}|${rows.map((r) => `${r.id}:${r.exists}`).join(',')}`;
  useEffect(() => {
    setSelected(new Set(rows.filter((r) => !r.exists).map((r) => r.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const copyable = rows.filter((r) => !r.exists);
  const allChecked = copyable.length > 0 && copyable.every((r) => selected.has(r.id));
  const groupName = (id) => source.structure?.ageGroups.find((g) => g.id === id)?.shortName || '—';
  const roomOf = (c) => {
    const l = c.locationId && md.locationById(c.locationId);
    return l ? l.room || l.name : '—';
  };

  const submit = async () => {
    setSaving(true);
    try {
      const result = await copyClasses(target.id, { sourceYearId: sourceId, classIds: [...selected] }, user);
      toast.success(copyResultMessage(result), `Sao chép lớp vào năm học ${target.name}`);
      onClose(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loading = source.loading || current.loading;

  return (
    <Modal
      open={open}
      size="lg"
      title={`Sao chép lớp vào năm học ${target?.name || ''}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving || loading || selected.size === 0}>
            {saving ? <Spinner small /> : <Copy size={16} />} Sao chép {selected.size} lớp
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert--danger mb-12" role="alert">
          {error}
        </div>
      )}
      {sources.length === 0 ? (
        <p className="text-2">Chưa có năm học nào khác để sao chép.</p>
      ) : (
        <>
          <FormField label="Sao chép từ năm học" hint="Chọn năm học bất kỳ; mặc định là năm học liền trước">
            <select className="select" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {sources.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} · {y.classCount} lớp
                </option>
              ))}
            </select>
          </FormField>
          {source.error || current.error ? (
            <ErrorState error={source.error || current.error} onRetry={source.reload} />
          ) : loading && !rows.length ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <p className="text-2 mt-12">Năm học này chưa có lớp.</p>
          ) : (
            <div className="table-wrap sc-table-flat mt-12">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th className="sc-check-col">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả lớp"
                        checked={allChecked}
                        disabled={!copyable.length}
                        onChange={() => setSelected(allChecked ? new Set() : new Set(copyable.map((r) => r.id)))}
                      />
                    </th>
                    <th>Lớp</th>
                    <th>Nhóm tuổi</th>
                    <th>Điểm trường</th>
                    <th>Phòng</th>
                    <th className="num">Sĩ số tối đa</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={c.exists ? 'muted' : undefined}>
                      <td className="sc-check-col">
                        <input
                          type="checkbox"
                          aria-label={`Chọn lớp ${c.name}`}
                          checked={selected.has(c.id)}
                          disabled={c.exists}
                          onChange={() => toggle(c.id)}
                        />
                      </td>
                      <td className="fw-600">
                        {c.name}
                        {c.exists && <span className="text-xs muted"> · đã có trong năm {target?.name}</span>}
                      </td>
                      <td>{groupName(c.ageGroupId)}</td>
                      <td>{md.campusById(c.campusId)?.shortName}</td>
                      <td>{roomOf(c)}</td>
                      <td className="num">{c.capacity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
