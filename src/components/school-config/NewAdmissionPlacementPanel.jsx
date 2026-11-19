import { useEffect, useMemo, useState } from 'react';
import { Save, Users } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { SelectField } from '@/components/form/Field';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { savePlacements } from '@/services/school-config/schoolConfigService';
import { formatDate } from '@/utils/format';

const initialRows = (admissions) => Object.fromEntries(admissions.map((item) => [item.admissionId, item.targetClassId || '']));

/** Trẻ mới đã tiếp nhận cho năm sắp diễn ra: xếp vào lớp năm mới hoặc để chờ xếp. */
export function NewAdmissionPlacementPanel({ yearId, admissions, targets, campusName, editable, onDirty, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const saved = useMemo(() => initialRows(admissions), [admissions]);
  const [rows, setRows] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setRows(saved), [saved]);
  const dirty = admissions.some((item) => rows[item.admissionId] !== saved[item.admissionId]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  const seats = useMemo(() => {
    const result = Object.fromEntries(targets.map((item) => [item.id, item.taken]));
    admissions.forEach((item) => {
      if (item.targetClassId) result[item.targetClassId] = (result[item.targetClassId] || 0) - 1;
    });
    Object.values(rows).forEach((classId) => {
      if (classId) result[classId] = (result[classId] || 0) + 1;
    });
    return result;
  }, [admissions, rows, targets]);
  const over = targets.filter((item) => seats[item.id] > item.capacity);

  const optionsFor = (item) =>
    targets.filter((target) => String(target.campusId) === String(item.campusId)).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const submit = async () => {
    if (!dirty || over.length) return;
    setSaving(true);
    setError('');
    try {
      await savePlacements(
        yearId,
        {
          items: [],
          newAdmissions: admissions.map((item) => ({ admissionId: item.admissionId, toClassId: rows[item.admissionId] || null })),
        },
        user,
      );
      toast.success('Đã lưu lớp dự kiến cho trẻ mới tiếp nhận.', 'Xếp lớp năm học mới');
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'child',
      header: 'Trẻ',
      render: (item) => (
        <>
          <b>{item.fullName}</b>
          <div className="muted text-xs">Sinh ngày {formatDate(item.birthDate)}</div>
        </>
      ),
    },
    { key: 'campus', header: 'Điểm trường', render: (item) => campusName(item.campusId) },
    { key: 'startDate', header: 'Ngày bắt đầu', className: 'nowrap', render: (item) => formatDate(item.startDate) },
    {
      key: 'classroom',
      header: 'Lớp năm học mới',
      render: (item) => {
        const value = rows[item.admissionId] || '';
        const selected = targets.find((target) => String(target.id) === String(value));
        return (
          <>
            <SelectField
              aria-label={`Lớp năm học mới của ${item.fullName}`}
              value={value}
              disabled={!editable}
              placeholder="Chờ xếp lớp"
              onChange={(event) => {
                setRows((current) => ({ ...current, [item.admissionId]: event.target.value }));
                setError('');
              }}
            >
              {optionsFor(item).map((target) => (
                <option
                  key={target.id}
                  value={target.id}
                  disabled={String(target.id) !== String(value) && seats[target.id] >= target.capacity}
                >
                  {target.name} · {seats[target.id]}/{target.capacity}
                </option>
              ))}
            </SelectField>
            {selected && seats[selected.id] > selected.capacity && <div className="field-error">Lớp đã vượt sĩ số tối đa</div>}
          </>
        );
      },
    },
  ];

  return (
    <section className="card card__body mb-16" aria-labelledby="new-admission-title">
      <div className="page__head mb-12">
        <div>
          <h2 id="new-admission-title" className="section-title">
            Trẻ mới tiếp nhận
          </h2>
          <p className="muted text-sm">Trẻ đăng ký trước cho năm học mới; có thể xếp lớp ngay hoặc để chờ xếp.</p>
        </div>
        {admissions.length > 0 && (
          <span className="chip chip--blue">
            Đã xếp {Object.values(rows).filter(Boolean).length}/{admissions.length}
          </span>
        )}
      </div>

      {error && (
        <div className="alert alert--danger mb-12" role="alert">
          {error}
        </div>
      )}
      {over.length > 0 && (
        <div className="alert alert--danger mb-12" role="alert">
          Vượt sĩ số tối đa: {over.map((item) => `${item.name} (${seats[item.id]}/${item.capacity})`).join(', ')}.
        </div>
      )}

      {!admissions.length ? (
        <EmptyState icon={Users} title="Chưa có trẻ mới tiếp nhận cho năm học này" />
      ) : (
        <>
          <DataTable columns={columns} rows={admissions} rowKey="admissionId" className="table--compact" />
          {editable && (
            <div className="form-actions mt-12">
              <Button disabled={!dirty || saving} onClick={() => setRows(saved)}>
                Hoàn tác
              </Button>
              <Button variant="primary" icon={Save} loading={saving} disabled={!dirty || over.length > 0} onClick={submit}>
                Lưu xếp lớp trẻ mới
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
