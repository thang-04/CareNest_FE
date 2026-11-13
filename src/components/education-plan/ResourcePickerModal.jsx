import { useEffect, useId, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { LABELS } from '@/components/ui/labels';
import { Eye } from '@/components/ui/icons';
import { Notice } from './eduUi';
import { LearningResourceViewer } from './LearningResourceViewer';
import { resourceLibraryService as library } from '@/services/education-plan/resourceLibraryService';
import { KIND_LABELS, MATCH_LABELS, SCOPE_LABELS, resourceKind } from '@/models/education-plan/learningResources.mjs';
import { Checkbox, TextField } from '@/components';

const TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'MINE', label: 'Của tôi' },
  { key: 'CLASS', label: 'Của lớp' },
  { key: 'SCHOOL', label: 'Của trường' },
];

/**
 * "Chọn từ kho" ở một mục hoạt động (BE:EDU-82, EDU-87): BE xếp học liệu Cùng MT → Cùng chủ đề → mới nhất, kể cả năm
 * trước; học liệu đã gắn vào mục ghi "Đã gắn", không tích được; không bao giờ tự gắn.
 * context: { docKey, activityKey, ageGroupId, themeId, themeName, goalIds }.
 */
export function ResourcePickerModal({ open, user, context, sectionLabel, onClose, onAttach }) {
  const id = useId();
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  // Gõ tìm: chờ người dùng ngừng gõ 300 ms rồi mới hỏi BE
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!open) return;
    setPage(0);
    setPicked(new Set());
    setPreview(null);
  }, [open, tab, query]);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setLoading(true);
    library
      .list(user, { view: tab, q: query, ...context, page, size: 50 })
      .then((res) => {
        if (!alive) return;
        setRows((prev) => (page === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.totalElements);
        setError('');
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // context đổi theo mục đang mở; chỉ hỏi lại khi mở modal, đổi tab, tìm hoặc xem thêm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, tab, query, page]);

  const toggle = (rid) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  const attach = async () => {
    setBusy(true);
    const ok = await onAttach([...picked]);
    setBusy(false);
    if (ok !== false) onClose();
  };

  return (
    <Modal
      open={open}
      size="lg"
      title={`Chọn học liệu từ kho${sectionLabel ? ` · ${sectionLabel}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {LABELS.cancel}
          </Button>
          <Button variant="primary" loading={busy} disabled={!picked.size} onClick={attach}>
            Gắn vào mục này{picked.size ? ` (${picked.size})` : ''}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Tabs ariaLabel="Phạm vi kho học liệu" value={tab} onChange={setTab} items={TABS} />
        <div className="field">
          <label className="field__label" htmlFor={`${id}-q`}>
            Tìm theo tên
          </label>
          <TextField id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="muted text-sm">Học liệu cùng MT hoặc cùng chủ đề với mục đang soạn được xếp lên đầu, kể cả học liệu năm trước.</p>
        {error && <Notice>{error}</Notice>}
        {!loading && !error && rows.length === 0 && (
          <p className="muted" role="status">
            {query
              ? `Không có học liệu tên chứa "${query}". Thử từ khóa ngắn hơn hoặc chọn tab Tất cả.`
              : 'Kho chưa có học liệu. Dùng "Tải lên" hoặc "Dán link" ở mục hoạt động để thêm học liệu đầu tiên.'}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="ga-resource-list" aria-label="Học liệu trong kho">
            {rows.map((r) => (
              <li key={r.id}>
                <label className="row gap-2">
                  <Checkbox checked={picked.has(r.id)} disabled={r.attached} onChange={() => toggle(r.id)} aria-label={`Chọn ${r.title}`} />
                  <span>
                    <span className="fw-600">{r.title}</span>
                    <span className="row gap-1 row--wrap text-sm">
                      <span className="chip chip--gray">{KIND_LABELS[resourceKind(r)]}</span>
                      <span className="chip chip--gray">{SCOPE_LABELS[r.scope]}</span>
                      {r.match && <span className="chip chip--green">{MATCH_LABELS[r.match]}</span>}
                      {r.attached && <span className="chip chip--blue">Đã gắn</span>}
                      <span className="muted">Đang dùng: {r.usageCount}</span>
                    </span>
                  </span>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Eye}
                  aria-expanded={preview?.id === r.id}
                  onClick={() => setPreview(preview?.id === r.id ? null : r)}
                >
                  {preview?.id === r.id ? 'Ẩn xem' : 'Xem'}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {preview && <LearningResourceViewer user={user} resource={preview} load={() => library.contentUrl(user, preview.id)} />}
        {loading && <p role="status">Đang tải học liệu…</p>}
        {!loading && rows.length < total && (
          <Button variant="outline-primary" size="sm" onClick={() => setPage((p) => p + 1)}>
            Xem thêm ({total - rows.length})
          </Button>
        )}
      </div>
    </Modal>
  );
}
