import { useMemo, useState } from 'react';
import { Download } from '@/components/ui/icons';
import { EmptyState, Modal } from '@/components/education-plan/eduUi';
import { className, periodLabel, typeLabel } from '@/components/education-plan/lessonShared';

/** Picks an existing weekly / daily plan to copy content from (only empty cells are filled). */
export default function ImportLessonModal({ lessons, themes, type, excludeId, classId, ageGroupId, onClose, onImport }) {
  const [scope, setScope] = useState('class');
  const sources = useMemo(
    () =>
      lessons
        .filter(
          (l) =>
            l.id !== excludeId &&
            l.type === type &&
            l.slots?.length &&
            (scope === 'class' ? l.classId === classId : l.ageGroupId === ageGroupId),
        )
        .sort((a, b) => (b.date || b.weekStart).localeCompare(a.date || a.weekStart)),
    [lessons, excludeId, type, scope, classId, ageGroupId],
  );
  const [sourceId, setSourceId] = useState('');
  const source = sources.find((l) => l.id === sourceId) || sources[0];

  return (
    <Modal
      title={`Lấy nội dung từ ${typeLabel(type).toLowerCase()} có sẵn`}
      width={720}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={!source} onClick={() => onImport(source)}>
            <Download size={16} aria-hidden /> Lấy nội dung
          </button>
        </>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="il-scope">
          Phạm vi
        </label>
        <select
          id="il-scope"
          className="select"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            setSourceId('');
          }}
        >
          <option value="class">Lớp của tôi</option>
          <option value="age">Các lớp cùng nhóm tuổi</option>
        </select>
      </div>
      {!source ? (
        <EmptyState title="Không có kế hoạch phù hợp" desc="Thử mở rộng phạm vi sang các lớp cùng nhóm tuổi." />
      ) : (
        <>
          <div className="field">
            <label className="field__label" htmlFor="il-src">
              {typeLabel(type)}
            </label>
            <select id="il-src" className="select" value={source.id} onChange={(e) => setSourceId(e.target.value)}>
              {sources.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · lớp {className(l.classId)} · {periodLabel(l)}
                </option>
              ))}
            </select>
          </div>
          <div className="ga-muted-box">
            <div className="fw-600 mb-8">
              Chủ đề: {themes.find((t) => t.id === source.themeId)?.name} · Tuần {source.weekIndex}: {source.branch}
            </div>
            <div className="ga-tags">
              {source.slots.map((s) => (
                <span key={s.id} className="chip chip--gray">
                  {s.name}
                </span>
              ))}
            </div>
          </div>
          <p className="muted text-xs">
            Nội dung được chép vào các ô còn trống theo đúng giờ sinh hoạt{type === 'week' ? ' và thứ trong tuần' : ''}. Ô bạn đã nhập giữ
            nguyên.
          </p>
        </>
      )}
    </Modal>
  );
}
