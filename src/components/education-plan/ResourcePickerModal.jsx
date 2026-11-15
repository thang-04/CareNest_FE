import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FilterChips } from '@/components/ui/FilterChips';
import { LABELS } from '@/components/ui/labels';
import { Eye, Link2, Upload } from '@/components/ui/icons';
import { FileInput } from '@/components/form/FileInput';
import { EmptyState, Modal, Notice } from './eduUi';
import { FilterSelect } from './planUi';
import { LearningResourceViewer } from './LearningResourceViewer';
import { ResourceLinkForm } from './ResourceLinkForm';
import { resourceLibraryService as library } from '@/services/education-plan/resourceLibraryService';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { KIND_LABELS, MATCH_LABELS, MEDIA_ACCEPT, formatBytes, norm, resourceKind } from '@/models/education-plan/learningResources.mjs';
import { Checkbox, TextField } from '@/components';

const ageName = (id) => AGE_GROUPS.find((g) => String(g.id) === String(id))?.name;
const themeKey = (t) => `${t.name}|${t.schoolYearId ?? ''}`;
const themeLabel = (t) => (t.schoolYearName ? `${t.name} · ${t.schoolYearName}` : t.name);

/**
 * Hộp "+ Thêm học liệu" của một mục hoạt động (BE:EDU-82/83/87, spec 901): kho của tôi (BE xếp Cùng MT → Cùng chủ đề → mới
 * nhất, mọi năm), tìm, lọc chủ đề đã dạy + nhóm tuổi; kèm Tải lên và Dán link. Học liệu đã gắn vào mục ghi "Đã gắn".
 * context: { docKey, activityKey, ageGroupId, themeId, themeName, goalIds }; room = số học liệu mục còn nhận.
 * onUpload(file, title) — title = tên người dùng đặt khi khác tên tệp (bỏ đuôi), null khi giữ nguyên; onAddLink({ url, title }) / onAttach(ids) trả true khi xong ⇒ đóng hộp.
 */
export function ResourcePickerModal({ user, context, sectionLabel, room, busy, error, onClose, onAttach, onUpload, onAddLink }) {
  const id = useId();
  const [mode, setMode] = useState('SUGGEST');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  // Mặc định cùng nhóm tuổi của lớp; học liệu không ghi nhóm tuổi luôn hiện (BE lọc)
  const [age, setAge] = useState(context.ageGroupId || '');
  const [theme, setTheme] = useState('');
  const [themes, setThemes] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [preview, setPreview] = useState(null);
  const [linkOpen, setLinkOpen] = useState(false);
  // Tệp vừa chọn chờ đặt tên trước khi tải lên: { file, base, name, error }
  const [pending, setPending] = useState(null);

  // Gõ tìm: chờ người dùng ngừng gõ 300 ms rồi mới hỏi BE
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setPage(0);
    setPicked(new Set());
    setPreview(null);
  }, [query, age, theme]);
  const chosen = themes.find((t) => themeKey(t) === theme);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    library
      .list(user, {
        ...context,
        q: query,
        ageGroupId: age || null,
        teachThemeName: chosen?.name,
        schoolYearId: chosen?.schoolYearId,
        page,
        size: 50,
      })
      .then((res) => {
        if (!alive) return;
        setRows((prev) => (page === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.totalElements);
        // Danh sách chủ đề để lọc = chủ đề đã dạy của học liệu đã tải (giữ lại qua các lần lọc)
        setThemes((prev) => {
          const all = new Map(prev.map((t) => [themeKey(t), t]));
          res.items.flatMap((r) => r.taughtThemes || []).forEach((t) => all.set(themeKey(t), t));
          return [...all.values()].sort((a, b) => themeLabel(a).localeCompare(themeLabel(b), 'vi'));
        });
        setLoadError('');
      })
      .catch((e) => alive && setLoadError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // context đổi theo mục đang mở; chỉ hỏi lại khi tìm, lọc hoặc xem thêm
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, query, age, theme, page]);

  const shown = mode === 'SUGGEST' ? rows.filter((r) => r.match) : rows;
  const filtered = !!(query || age || theme);
  const toggle = (rid) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  const done = async (fn) => {
    if ((await fn()) !== false) onClose();
  };
  const yearsOf = (r) =>
    [
      ...new Set(
        (r.taughtThemes || []).filter((t) => norm(t.name) === norm(context.themeName) && t.schoolYearName).map((t) => t.schoolYearName),
      ),
    ].join(', ');

  const addControls = (
    <div className="row gap-2 row--wrap" role="group" aria-label="Thêm học liệu mới vào mục">
      <label className="btn btn--sm btn--outline-primary" htmlFor={`${id}-file`} aria-disabled={busy || room < 1 || undefined}>
        <Upload size={15} aria-hidden /> Tải lên
      </label>
      <FileInput
        id={`${id}-file`}
        className="sr-only"
        accept={MEDIA_ACCEPT}
        disabled={busy || room < 1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const base = file.name.replace(/\.[^.]+$/, '');
          setLinkOpen(false);
          setPending({ file, base, name: base, error: '' });
        }}
      />
      <Button
        variant="outline-primary"
        size="sm"
        icon={Link2}
        disabled={busy || room < 1}
        aria-expanded={linkOpen}
        onClick={() => {
          setPending(null);
          setLinkOpen((v) => !v);
        }}
      >
        Dán link
      </Button>
    </div>
  );

  const submitUpload = (e) => {
    e.preventDefault();
    const name = pending.name.trim();
    if (!name) {
      setPending({ ...pending, error: 'Nhập tên học liệu.' });
      return;
    }
    done(() => onUpload(pending.file, name === pending.base ? null : name));
  };
  const uploadForm = pending && (
    <form className="ga-resource-link" onSubmit={submitUpload} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-name`}>
          Tên học liệu
        </label>
        <TextField
          id={`${id}-name`}
          value={pending.name}
          maxLength={255}
          required
          autoFocus
          aria-invalid={!!pending.error}
          aria-describedby={`${id}-name-hint${pending.error ? ` ${id}-name-err` : ''}`}
          onChange={(e) => setPending({ ...pending, name: e.target.value, error: '' })}
        />
        <p id={`${id}-name-hint`} className="muted text-sm">
          Tệp: {pending.file.name} · {formatBytes(pending.file.size)}
        </p>
        {pending.error && (
          <p id={`${id}-name-err`} className="field__error" role="alert">
            {pending.error}
          </p>
        )}
      </div>
      <div className="row gap-2 mt-8">
        <Button type="submit" size="sm" variant="primary" icon={Upload} loading={busy}>
          Tải lên
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)} disabled={busy}>
          {LABELS.cancel}
        </Button>
      </div>
    </form>
  );

  return (
    <Modal
      width={700}
      title={`Thêm học liệu · ${sectionLabel}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {LABELS.cancel}
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!picked.size || picked.size > room}
            onClick={() => done(() => onAttach([...picked]))}
          >
            Gắn vào mục này{picked.size ? ` (${picked.size})` : ''}
          </Button>
        </>
      }
    >
      {busy && <p role="status">Đang lưu học liệu…</p>}
      {error && <Notice>{error}</Notice>}
      {picked.size > room && <Notice>Mục chỉ còn nhận {room} học liệu; bỏ chọn bớt.</Notice>}
      {!loading && !loadError && !filtered && rows.length === 0 ? (
        <EmptyState
          title="Kho của bạn chưa có học liệu"
          desc="Tải lên tệp hoặc dán link YouTube, Google Drive: học liệu được gắn vào mục này và tự vào kho để dùng lại."
          action={addControls}
        />
      ) : (
        <>
          <div className="filter-bar">
            <div className="field">
              <label className="field__label" htmlFor={`${id}-q`}>
                Tìm theo tên
              </label>
              <TextField id={`${id}-q`} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <FilterSelect
              label="Chủ đề đã dạy"
              value={theme}
              onChange={setTheme}
              options={[{ value: '', label: 'Mọi chủ đề' }, ...themes.map((t) => ({ value: themeKey(t), label: themeLabel(t) }))]}
            />
            <FilterSelect
              label="Nhóm tuổi"
              value={age}
              onChange={setAge}
              options={[{ value: '', label: 'Mọi nhóm tuổi' }, ...AGE_GROUPS.map((g) => ({ value: String(g.id), label: g.name }))]}
            />
          </div>
          <FilterChips
            count={total}
            unit="học liệu"
            chips={[
              query && { key: 'q', label: `Tên: ${query}`, onRemove: () => setQ('') },
              chosen && { key: 'theme', label: `Chủ đề: ${themeLabel(chosen)}`, onRemove: () => setTheme('') },
              age && { key: 'age', label: `Nhóm tuổi: ${ageName(age)}`, onRemove: () => setAge('') },
            ].filter(Boolean)}
          />
          <div className="row gap-2" role="group" aria-label="Hiển thị">
            <Button
              size="sm"
              variant={mode === 'SUGGEST' ? 'primary' : 'ghost'}
              aria-pressed={mode === 'SUGGEST'}
              onClick={() => setMode('SUGGEST')}
            >
              Gợi ý
            </Button>
            <Button size="sm" variant={mode === 'ALL' ? 'primary' : 'ghost'} aria-pressed={mode === 'ALL'} onClick={() => setMode('ALL')}>
              Tất cả
            </Button>
          </div>
          {loadError && <Notice>{loadError}</Notice>}
          {!loading && !loadError && shown.length === 0 && (
            <p className="muted" role="status">
              {mode === 'SUGGEST' && rows.length
                ? 'Chưa có học liệu cùng MT hoặc cùng chủ đề với mục này. Bấm "Tất cả" để xem cả kho.'
                : 'Không có học liệu khớp bộ lọc. Bỏ bớt bộ lọc ở trên.'}
            </p>
          )}
          {shown.length > 0 && (
            <ul className="ga-resource-list ga-resource-pick" aria-label="Học liệu trong kho của tôi">
              {shown.map((r) => (
                <li key={r.id}>
                  <label className="row gap-2">
                    <Checkbox
                      checked={picked.has(r.id)}
                      disabled={r.attached}
                      onChange={() => toggle(r.id)}
                      aria-label={r.attached ? `${r.title} đã gắn vào mục` : `Chọn ${r.title}`}
                    />
                    <span className="ga-resource-pick__text">
                      <span className="fw-600 ga-resource-pick__name">{r.title}</span>
                      <span className="row gap-1 row--wrap text-sm">
                        <span className="chip chip--gray">{KIND_LABELS[resourceKind(r)]}</span>
                        {r.match === 'GOAL' && <span className="chip chip--green">{MATCH_LABELS.GOAL}</span>}
                        {r.match === 'THEME' && (
                          <span className="chip chip--green">
                            {MATCH_LABELS.THEME}
                            {yearsOf(r) ? ` · ${yearsOf(r)}` : ''}
                          </span>
                        )}
                        {r.attached && <span className="chip chip--blue">Đã gắn</span>}
                        {ageName(r.ageGroupId) && <span className="muted">{ageName(r.ageGroupId)}</span>}
                      </span>
                    </span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ga-resource-pick__view"
                    icon={Eye}
                    aria-expanded={preview?.id === r.id}
                    aria-label={`${preview?.id === r.id ? 'Ẩn xem' : 'Xem'} ${r.title}`}
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
          <h3 className="field__label">Hoặc thêm học liệu mới</h3>
          {addControls}
        </>
      )}
      {uploadForm}
      {linkOpen && <ResourceLinkForm busy={busy} onSubmit={(v) => done(() => onAddLink(v))} onCancel={() => setLinkOpen(false)} />}
    </Modal>
  );
}
