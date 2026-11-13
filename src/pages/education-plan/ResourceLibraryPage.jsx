import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, Modal, Notice, PageHead, fmtDateTime } from '@/components/education-plan/eduUi';
import { FilterSelect } from '@/components/education-plan/planUi';
import { LearningResourceViewer } from '@/components/education-plan/LearningResourceViewer';
import { ResourceTagsModal } from '@/components/education-plan/ResourceTagsModal';
import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FilterChips } from '@/components/ui/FilterChips';
import { RowMenu } from '@/components/ui/RowMenu';
import { LoadingState } from '@/components/ui/States';
import { LABELS } from '@/components/ui/labels';
import { Eye, MapPin, Pencil, Tag, Trash2 } from '@/components/ui/icons';
import { useAsync } from '@/hooks/useAsync';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { resourceLibraryService as api } from '@/services/education-plan/resourceLibraryService';
import { AGE_GROUPS, EDU_STATUS_LABELS } from '@/models/education-plan/educationPlanConstants';
import { mondayOf } from '@/models/education-plan/classPlan';
import {
  KIND_LABELS,
  deletableText,
  dmy,
  formatBytes,
  resourceKind,
  taughtThemeGroups,
} from '@/models/education-plan/learningResources.mjs';
import { DataTable, TextField } from '@/components';

const KIND_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'FILE', label: 'Tệp' },
  { value: 'LINK', label: 'Link' },
];
const ageName = (id) => AGE_GROUPS.find((g) => String(g.id) === String(id))?.name;
const themeKey = (t) => `${t.name}|${t.schoolYearId ?? ''}`;
const themeLabel = (t) => (t.schoolYearName ? `${t.name} · ${t.schoolYearName}` : t.name);

/**
 * Kho học liệu của tôi (spec 901, BE:EDU-82…88): chỉ học liệu người dùng đã thêm ở giáo án ngày, nhóm theo chủ đề đã dạy +
 * năm học. Đổi tên, sửa nhãn, xem nơi đang dùng, xóa vĩnh viễn (BE khóa khi giáo án Chờ duyệt / chưa qua ngày dạy — 7137).
 */
export default function ResourceLibraryPage() {
  const id = useId();
  const { user, toast } = useEducationPlan();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [theme, setTheme] = useState('');
  const [themes, setThemes] = useState([]);
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [query, kind, ageGroupId, theme]);
  const chosen = themes.find((t) => themeKey(t) === theme);
  const list = useAsync(
    () =>
      api.list(user, {
        q: query,
        kind,
        ageGroupId: ageGroupId || null,
        teachThemeName: chosen?.name,
        schoolYearId: chosen?.schoolYearId,
        page,
        size: 50,
      }),
    [user, query, kind, ageGroupId, theme, page],
    { refreshOnDataChange: true },
  );
  const items = list.data?.items || [];
  const total = list.data?.totalElements || 0;
  // Danh sách chủ đề để lọc = chủ đề đã dạy của học liệu đã tải (giữ lại qua các lần lọc)
  useEffect(() => {
    const seen = (list.data?.items || []).flatMap((r) => r.taughtThemes || []);
    if (!seen.length) return;
    setThemes((prev) => {
      const all = new Map(prev.map((t) => [themeKey(t), t]));
      seen.forEach((t) => all.set(themeKey(t), t));
      return all.size === prev.length ? prev : [...all.values()].sort((a, b) => themeLabel(a).localeCompare(themeLabel(b), 'vi'));
    });
  }, [list.data]);

  const menuOf = (r) => [
    { label: 'Xem', icon: Eye, onClick: () => setModal({ type: 'view', item: r }) },
    { label: 'Đổi tên', icon: Pencil, onClick: () => setModal({ type: 'rename', item: r }) },
    { label: 'Sửa nhãn', icon: Tag, onClick: () => setModal({ type: 'tags', item: r }) },
    { label: 'Nơi đang dùng', icon: MapPin, onClick: () => setModal({ type: 'usages', item: r }) },
    { label: 'Xóa vĩnh viễn', icon: Trash2, danger: true, onClick: () => setModal({ type: 'delete', item: r }) },
  ];
  const columns = [
    {
      key: 'title',
      header: 'Học liệu',
      render: (r) => (
        <>
          <div className="fw-600">{r.title}</div>
          <span className="muted text-sm">
            {KIND_LABELS[resourceKind(r)]}
            {r.kind === 'FILE' && r.byteSize ? ` · ${formatBytes(r.byteSize)}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'tags',
      header: 'Nhãn',
      render: (r) => {
        const goals = new Set((r.tags || []).filter((t) => t.kind === 'GOAL').map((t) => String(t.refId))).size;
        return (
          <div className="row gap-1 row--wrap">
            <span className="chip chip--gray">{ageName(r.ageGroupId) || 'Mọi nhóm tuổi'}</span>
            {(r.taughtThemes || []).map((t) => (
              <span key={themeKey(t)} className="chip chip--blue">
                {themeLabel(t)}
              </span>
            ))}
            {goals > 0 && <span className="chip chip--green">{goals} MT</span>}
          </div>
        );
      },
    },
    {
      key: 'usage',
      header: 'Đang dùng',
      className: 'center',
      render: (r) =>
        r.usageCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Nơi đang dùng ${r.title}: ${r.usageCount} mục`}
            onClick={() => setModal({ type: 'usages', item: r })}
          >
            {r.usageCount} mục
          </Button>
        ) : (
          <span className="muted">0</span>
        ),
    },
    { key: 'updatedAt', header: 'Cập nhật', render: (r) => fmtDateTime(r.updatedAt) },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'cell--actions',
      render: (r) => <RowMenu label={`Thao tác với ${r.title}`} items={menuOf(r)} />,
    },
  ];
  const filtered = !!(query || kind || ageGroupId || theme);

  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kho học liệu' }]}
          title="Kho học liệu của tôi"
          desc="Học liệu bạn đã thêm ở mục III của kế hoạch giáo dục ngày, xếp theo chủ đề đã dạy để dùng lại ở ngày khác, năm sau. Chỉ bạn thấy kho này."
        />
        <div className="card mb-16">
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
            <FilterSelect label="Loại" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <FilterSelect
              label="Nhóm tuổi"
              value={ageGroupId}
              onChange={setAgeGroupId}
              options={[{ value: '', label: 'Tất cả' }, ...AGE_GROUPS.map((g) => ({ value: String(g.id), label: g.name }))]}
            />
          </div>
          <FilterChips
            count={total}
            unit="học liệu"
            chips={[
              query && { key: 'q', label: `Tên: ${query}`, onRemove: () => setQ('') },
              chosen && { key: 'theme', label: `Chủ đề: ${themeLabel(chosen)}`, onRemove: () => setTheme('') },
              kind && { key: 'kind', label: `Loại: ${KIND_OPTIONS.find((o) => o.value === kind).label}`, onRemove: () => setKind('') },
              ageGroupId && { key: 'age', label: `Nhóm tuổi: ${ageName(ageGroupId)}`, onRemove: () => setAgeGroupId('') },
            ].filter(Boolean)}
          />
        </div>
      </div>
      {list.error && <Notice>{list.error.message}</Notice>}
      {list.loading && !list.data ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <Card bodyClass={null}>
          <EmptyState
            title={filtered ? 'Không có học liệu khớp bộ lọc' : 'Kho của bạn chưa có học liệu'}
            desc={
              filtered
                ? 'Bỏ bớt bộ lọc hoặc thử từ khóa ngắn hơn.'
                : 'Mở kế hoạch giáo dục ngày, mục III, bấm "+ Thêm học liệu" để tải lên hoặc dán link. Học liệu tự vào kho này.'
            }
          />
        </Card>
      ) : (
        <>
          {taughtThemeGroups(items).map((g) => (
            <Card
              key={g.key}
              title={`${g.schoolYearName ? `${g.name} · ${g.schoolYearName}` : g.name} (${g.items.length})`}
              bodyClass={null}
            >
              <div className="card__body">
                <DataTable rows={g.items} columns={columns} />
              </div>
            </Card>
          ))}
          {list.data?.totalPages > 1 && (
            <div className="row gap-2 mt-16">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Trang trước
              </Button>
              <span className="muted text-sm">
                Trang {page + 1}/{list.data.totalPages} · {total} học liệu
              </span>
              <Button size="sm" variant="ghost" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Trang sau
              </Button>
            </div>
          )}
        </>
      )}
      {modal && (
        <ResourceModals
          modal={modal}
          user={user}
          taught={themes}
          onClose={() => setModal(null)}
          onDone={(message) => {
            toast(message);
            setModal(null);
            list.reload({ silent: true });
          }}
        />
      )}
    </div>
  );
}

/** Hộp thoại của trang Kho: xem, đổi tên, sửa nhãn, nơi đang dùng, xóa vĩnh viễn (khóa ⇒ thông báo chặn). */
function ResourceModals({ modal, user, taught, onClose, onDone }) {
  const id = useId();
  const { classes } = useEducationPlan();
  const item = modal.item;
  const [title, setTitle] = useState(item.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const usages = useAsync(
    () => (modal.type === 'usages' || modal.type === 'delete' ? api.usages(user, item.id) : Promise.resolve(null)),
    [modal.type, item.id],
  );
  // Lỗi (vd. 7137 bị khóa) hiện ngay trong hộp, giữ dữ liệu đang nhập
  const save = async (fn, message) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onDone(message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const className = (cid) => classes.find((c) => String(c.id) === String(cid))?.name || 'Lớp';
  const place = (u) => `${className(u.classroomId)} – ${dmy(u.date)} – ${u.activityLabel}`;
  const rows = usages.data?.rows || [];

  if (modal.type === 'view')
    return (
      <Modal width={700} title={item.title} onClose={onClose} footer={<Button onClick={onClose}>{LABELS.close}</Button>}>
        <LearningResourceViewer user={user} resource={item} load={() => api.contentUrl(user, item.id)} />
      </Modal>
    );
  if (modal.type === 'rename')
    return (
      <Modal
        title="Đổi tên học liệu"
        onClose={onClose}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {LABELS.cancel}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!title.trim() || title.trim() === item.title}
              onClick={() => save(() => api.update(user, item.id, { title: title.trim() }), 'Đã đổi tên học liệu')}
            >
              {LABELS.save}
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor={`${id}-title`}>
            Tên hiển thị
          </label>
          <TextField
            id={`${id}-title`}
            value={title}
            maxLength={255}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {error && (
            <p id={`${id}-err`} className="field__error" role="alert">
              {error}
            </p>
          )}
        </div>
        <p className="muted text-sm">Tên mới hiện ở mọi giáo án đang dùng học liệu này.</p>
      </Modal>
    );
  if (modal.type === 'tags')
    return (
      <ResourceTagsModal
        item={item}
        taught={taught}
        busy={busy}
        error={error}
        onClose={onClose}
        onSave={(patch) => save(() => api.update(user, item.id, patch), 'Đã lưu nhãn học liệu')}
      />
    );
  const usageList = (
    <ul className="ga-resource-list">
      {rows.map((u) => (
        <li key={u.attachmentId}>
          <span>
            {place(u)} <span className="muted text-sm">· {EDU_STATUS_LABELS[u.status] || u.status}</span>
          </span>
          {u.classroomId && (
            <Link className="btn btn--sm btn--outline-primary" to={`/education/day-plans/${u.classroomId}?week=${mondayOf(u.date)}`}>
              Mở giáo án ngày
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
  if (usages.loading || (usages.error && modal.type === 'delete'))
    return (
      <Modal title={item.title} onClose={onClose} footer={<Button onClick={onClose}>{LABELS.close}</Button>}>
        {usages.error ? <Notice>{usages.error.message}</Notice> : <LoadingState text="Đang kiểm tra nơi đang dùng…" />}
      </Modal>
    );
  if (modal.type === 'usages')
    return (
      <Modal title={`Nơi đang dùng: ${item.title}`} onClose={onClose} footer={<Button onClick={onClose}>{LABELS.close}</Button>}>
        {usages.error && <Notice>{usages.error.message}</Notice>}
        {!usages.error && (rows.length ? usageList : <p className="muted">Học liệu chưa gắn vào giáo án nào.</p>)}
      </Modal>
    );
  // BE:EDU-85 (spec 901) — đang gắn ở giáo án Chờ duyệt / đã ban hành chưa qua ngày dạy ⇒ chỉ báo, không cho xác nhận
  if (usages.data?.locked)
    return (
      <Modal title="Chưa xóa được học liệu" onClose={onClose} footer={<Button onClick={onClose}>{LABELS.close}</Button>}>
        <p>
          "{item.title}" đang dùng ở giáo án chờ duyệt hoặc chưa qua ngày dạy. {deletableText(usages.data.deletableFrom)}
        </p>
        <ul className="ga-resource-list">
          {rows
            .filter((u) => u.locked)
            .map((u) => (
              <li key={u.attachmentId}>
                {place(u)} · {EDU_STATUS_LABELS[u.status] || u.status}
              </li>
            ))}
        </ul>
      </Modal>
    );
  return (
    <ConfirmationModal
      open
      danger
      title="Xóa vĩnh viễn học liệu?"
      message={
        rows.length
          ? `"${item.title}" và tệp đi kèm bị xóa hẳn, đồng thời gỡ khỏi ${rows.length} mục đang dùng dưới đây. Không khôi phục được.`
          : `"${item.title}" và tệp đi kèm bị xóa hẳn, không khôi phục được.`
      }
      confirmLabel="Xóa vĩnh viễn"
      error={error}
      onClose={onClose}
      onConfirm={() => save(() => api.remove(user, item.id), 'Đã xóa học liệu')}
    >
      {rows.length > 0 && usageList}
    </ConfirmationModal>
  );
}
