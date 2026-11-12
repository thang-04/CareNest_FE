import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, Notice, PageHead, fmtDateTime } from '@/components/education-plan/eduUi';
import { FilterSelect } from '@/components/education-plan/planUi';
import { LearningResourceViewer } from '@/components/education-plan/LearningResourceViewer';
import { ResourceLinkForm } from '@/components/education-plan/ResourceLinkForm';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RowMenu } from '@/components/ui/RowMenu';
import { LoadingState } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { LABELS } from '@/components/ui/labels';
import { FileInput } from '@/components/form/FileInput';
import { Eye, EyeOff, Link2, Pencil, Send, Trash2, Upload, Users } from '@/components/ui/icons';
import { useAsync } from '@/hooks/useAsync';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { resourceLibraryService as api } from '@/services/education-plan/resourceLibraryService';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { mondayOf } from '@/models/education-plan/classPlan';
import {
  KIND_LABELS,
  MEDIA_ACCEPT,
  SCOPE_LABELS,
  formatBytes,
  resourceKind,
} from '@/models/education-plan/learningResources.mjs';
import { canPublishSchool, canReviewResources } from '@/utils/education-plan/resourcePermissions';

const KIND_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'FILE', label: 'Tệp' },
  { value: 'LINK', label: 'Link' },
];
const ageName = (id) => AGE_GROUPS.find((g) => String(g.id) === String(id))?.name;

/**
 * Kho học liệu (spec 900, BE:EDU-82…88): học liệu lưu một lần, dùng lại ở nhiều giáo án ngày. Tải lên/dán link không cần
 * giáo án, đổi tên, chia sẻ cho lớp, đề nghị lên kho trường (tổ trưởng nhóm tuổi / PHT duyệt), ẩn, xóa khi không còn dùng.
 */
export default function ResourceLibraryPage() {
  const id = useId();
  const { user, classes, toast } = useEducationPlan();
  const reviewer = canReviewResources(user);
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [ageGroupId, setAgeGroupId] = useState('');
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [tab, query, kind, ageGroupId]);
  const list = useAsync(
    () => api.list(user, { view: tab, q: query, kind, ageGroupId: ageGroupId || null, page, size: 50 }),
    [user, tab, query, kind, ageGroupId, page],
    { refreshOnDataChange: true },
  );

  // Mọi thao tác ghi: khóa nút, báo kết quả, nạp lại danh sách; lỗi giữ nguyên dữ liệu người dùng đang nhập
  const act = async (fn, done) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done);
      setModal(null);
      list.reload({ silent: true });
      return true;
    } catch (e) {
      toast(e.message, 'warn');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const upload = (input) => {
    const file = input.files?.[0];
    if (!file) return;
    act(() => api.upload(user, file, { ageGroupId: ageGroupId || null }), 'Đã thêm học liệu vào kho').then(() => (input.value = ''));
  };
  const remove = (r) =>
    act(() => api.remove(user, r.id), 'Đã xóa học liệu').then((ok) => {
      // BE:EDU-85 — còn giáo án dùng thì chỉ ẩn được
      if (!ok && r.usageCount > 0) setModal({ type: 'inUse', item: r });
    });

  const items = list.data?.items || [];
  const total = list.data?.totalElements || 0;
  const tabs = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'MINE', label: 'Của tôi' },
    { key: 'CLASS', label: 'Của lớp' },
    { key: 'SCHOOL', label: 'Của trường' },
    ...(reviewer ? [{ key: 'PENDING', label: 'Chờ duyệt' }] : []),
    { key: 'HIDDEN', label: 'Đã ẩn' },
  ];
  const menuOf = (r) =>
    [
      { label: 'Xem', icon: Eye, onClick: () => setModal({ type: 'view', item: r }) },
      r.canEdit && { label: 'Sửa tên, nhóm tuổi, nhãn', icon: Pencil, onClick: () => setModal({ type: 'edit', item: r }) },
      r.mine && !r.shareStatus && r.scope === 'MINE' && {
        label: 'Chia sẻ cho lớp',
        icon: Users,
        onClick: () => setModal({ type: 'class', item: r }),
      },
      r.mine && r.scope === 'CLASS' && !r.shareStatus && {
        label: 'Thôi chia sẻ cho lớp',
        icon: Users,
        onClick: () => act(() => api.share(user, r.id, { scope: 'MINE' }), 'Đã thôi chia sẻ'),
      },
      r.canEdit && r.scope !== 'SCHOOL' && r.shareStatus !== 'PENDING' && {
        label: canPublishSchool(user) ? 'Đưa lên kho trường' : 'Đề nghị lên kho trường',
        icon: Send,
        onClick: () =>
          act(
            () => api.share(user, r.id, { scope: 'SCHOOL' }),
            canPublishSchool(user) ? 'Đã đưa lên kho trường' : 'Đã gửi đề nghị, chờ tổ trưởng hoặc PHT duyệt',
          ),
      },
      r.mine && r.shareStatus === 'PENDING' && {
        label: 'Rút đề nghị',
        icon: Send,
        onClick: () => act(() => api.withdraw(user, r.id), 'Đã rút đề nghị'),
      },
      r.canEdit && r.scope === 'SCHOOL' && !r.mine && {
        label: 'Gỡ khỏi kho trường',
        icon: Users,
        onClick: () => act(() => api.share(user, r.id, { scope: 'MINE' }), 'Đã gỡ khỏi kho trường'),
      },
      r.canEdit && {
        label: r.hidden ? 'Hiện lại' : 'Ẩn khỏi kho',
        icon: r.hidden ? Eye : EyeOff,
        onClick: () => act(() => api.update(user, r.id, { hidden: !r.hidden }), r.hidden ? 'Đã hiện lại' : 'Đã ẩn khỏi kho'),
      },
      r.canEdit && { label: 'Xóa khỏi kho', icon: Trash2, onClick: () => setModal({ type: 'delete', item: r }) },
    ].filter(Boolean);

  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kho học liệu' }]}
          title="Kho học liệu"
          desc="Tải lên một lần, dùng lại ở nhiều ngày, nhiều lớp, nhiều năm. Gắn vào giáo án ở mục III của kế hoạch giáo dục ngày."
        />
        <div className="card mb-16">
          <div className="filter-bar">
            <div className="field">
              <label className="field__label" htmlFor={`${id}-q`}>
                Tìm theo tên
              </label>
              <input id={`${id}-q`} className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <FilterSelect label="Loại" value={kind} onChange={setKind} options={KIND_OPTIONS} />
            <FilterSelect
              label="Nhóm tuổi"
              value={ageGroupId}
              onChange={setAgeGroupId}
              options={[{ value: '', label: 'Tất cả' }, ...AGE_GROUPS.map((g) => ({ value: String(g.id), label: g.name }))]}
            />
          </div>
        </div>
        <div className="mb-16">
          <Tabs ariaLabel="Phạm vi kho học liệu" value={tab} onChange={setTab} items={tabs} />
        </div>
        <div className="ga-year-toolbar" role="group" aria-label="Thêm học liệu">
          <div className="ga-year-toolbar__group">
            <span className="muted text-sm">Học liệu mới vào "Của tôi"{ageGroupId ? `, nhóm tuổi ${ageName(ageGroupId)}` : ''}.</span>
          </div>
          <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
            <label className="btn btn--sm btn--outline-primary" htmlFor={`${id}-file`}>
              <Upload size={15} aria-hidden /> Tải lên
            </label>
            <FileInput id={`${id}-file`} className="sr-only" accept={MEDIA_ACCEPT} disabled={busy} onChange={(e) => upload(e.target)} />
            <Button
              size="sm"
              variant="outline-primary"
              icon={Link2}
              aria-expanded={adding === 'link'}
              onClick={() => setAdding(adding === 'link' ? '' : 'link')}
            >
              Dán link
            </Button>
          </div>
        </div>
      </div>
      {adding === 'link' && (
        <Card title="Thêm link vào kho">
          <ResourceLinkForm
            busy={busy}
            submitLabel="Thêm vào kho"
            onCancel={() => setAdding('')}
            onSubmit={({ url, title }) =>
              act(() => api.addLink(user, { url, title, ageGroupId: ageGroupId || null }), 'Đã thêm link vào kho').then((ok) => {
                if (ok) setAdding('');
                return ok;
              })
            }
          />
        </Card>
      )}
      <Card bodyClass={null}>
        {list.error && (
          <div className="card__body">
            <Notice>{list.error.message}</Notice>
          </div>
        )}
        {list.loading && !list.data ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState
            title={tab === 'PENDING' ? 'Không có đề nghị chờ duyệt' : 'Chưa có học liệu'}
            desc={
              tab === 'PENDING'
                ? undefined
                : query
                  ? `Không có học liệu tên chứa "${query}". Thử từ khóa ngắn hơn.`
                  : 'Bấm "Tải lên" hoặc "Dán link" để thêm học liệu đầu tiên.'
            }
          />
        ) : (
          <div className="card__body">
            <div className="table-wrap">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th>Học liệu</th>
                    <th>Nhãn</th>
                    <th className="center">Đang dùng</th>
                    <th>Phạm vi</th>
                    <th>Cập nhật</th>
                    <th className="cell--actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const themes = (r.tags || []).filter((t) => t.kind === 'THEME' && t.name).map((t) => t.name);
                    const goals = (r.tags || []).filter((t) => t.kind === 'GOAL').length;
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="fw-600">{r.title}</div>
                          <span className="muted text-sm">
                            {KIND_LABELS[resourceKind(r)]}
                            {r.kind === 'FILE' && r.byteSize ? ` · ${formatBytes(r.byteSize)}` : ''}
                          </span>
                        </td>
                        <td>
                          <div className="row gap-1 row--wrap">
                            <span className="chip chip--gray">{ageName(r.ageGroupId) || 'Mọi nhóm tuổi'}</span>
                            {themes.map((t) => (
                              <span key={t} className="chip chip--blue">
                                {t}
                              </span>
                            ))}
                            {goals > 0 && <span className="chip chip--green">{goals} MT</span>}
                          </div>
                        </td>
                        <td className="center">
                          {r.usageCount > 0 ? (
                            <Button variant="ghost" size="sm" onClick={() => setModal({ type: 'usages', item: r })}>
                              {r.usageCount} mục
                            </Button>
                          ) : (
                            <span className="muted">0</span>
                          )}
                        </td>
                        <td>
                          <span className="chip chip--gray">{SCOPE_LABELS[r.scope]}</span>
                          {r.shareStatus === 'PENDING' && <span className="chip chip--purple">Chờ duyệt lên trường</span>}
                          {r.shareStatus === 'REJECTED' && (
                            <p className="field__error">Bị trả lại: {r.shareReason}</p>
                          )}
                          {r.hidden && <span className="chip chip--orange">Đã ẩn</span>}
                        </td>
                        <td>{fmtDateTime(r.updatedAt)}</td>
                        <td className="cell--actions">
                          {tab === 'PENDING' && r.canReview ? (
                            <div className="row gap-2">
                              <Button size="sm" variant="ghost" icon={Eye} onClick={() => setModal({ type: 'view', item: r })}>
                                Xem
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                loading={busy}
                                onClick={() => act(() => api.review(user, r.id, { approve: true }), 'Đã duyệt lên kho trường')}
                              >
                                Duyệt
                              </Button>
                              <Button size="sm" variant="outline-primary" onClick={() => setModal({ type: 'reject', item: r })}>
                                Trả lại
                              </Button>
                            </div>
                          ) : (
                            <RowMenu label={`Thao tác với ${r.title}`} items={menuOf(r)} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
          </div>
        )}
      </Card>
      <ResourceModals modal={modal} setModal={setModal} user={user} classes={classes} busy={busy} act={act} remove={remove} />
    </div>
  );
}

/** Các hộp thoại của trang Kho: xem, đổi tên, chia sẻ lớp, nơi đang dùng, trả lại, xóa, đang dùng ⇒ ẩn. */
function ResourceModals({ modal, setModal, user, classes, busy, act, remove }) {
  const id = useId();
  const [text, setText] = useState('');
  const [age, setAge] = useState('');
  const [classId, setClassId] = useState('');
  const [drop, setDrop] = useState({ theme: false, goals: false });
  const usages = useAsync(
    () => (modal?.type === 'usages' ? api.usages(user, modal.item.id) : Promise.resolve([])),
    [modal?.type, modal?.item?.id],
  );
  useEffect(() => {
    setText(modal?.type === 'edit' ? modal.item.title : '');
    setAge(modal?.type === 'edit' && modal.item.ageGroupId ? String(modal.item.ageGroupId) : '');
    setClassId('');
    setDrop({ theme: false, goals: false });
  }, [modal]);
  if (!modal) return null;
  const item = modal.item;
  const close = () => setModal(null);
  const themeTag = (item?.tags || []).find((t) => t.kind === 'THEME');
  const goalTags = (item?.tags || []).filter((t) => t.kind === 'GOAL');
  // Bỏ nhãn không đúng (spec 900 vòng 13): gửi lại toàn bộ nhãn còn giữ, BE thay nhãn cũ
  const keptTags = () =>
    drop.theme || drop.goals
      ? {
          tags: {
            themeId: drop.theme ? null : (themeTag?.refId ?? null),
            themeName: drop.theme ? null : (themeTag?.name ?? null),
            goalIds: drop.goals ? [] : goalTags.map((t) => t.refId),
          },
        }
      : {};
  const classOf = (cid) => classes.find((c) => String(c.id) === String(cid));

  if (modal.type === 'view')
    return (
      <Modal open size="lg" title={item.title} onClose={close} footer={<Button onClick={close}>{LABELS.close}</Button>}>
        <LearningResourceViewer user={user} resource={item} load={() => api.contentUrl(user, item.id)} />
      </Modal>
    );
  if (modal.type === 'usages')
    return (
      <Modal open title={`Đang dùng: ${item.title}`} onClose={close} footer={<Button onClick={close}>{LABELS.close}</Button>}>
        {usages.loading ? (
          <LoadingState />
        ) : (
          <ul className="ga-resource-list">
            {(usages.data || []).map((u) => (
              <li key={u.attachmentId}>
                <span>
                  {classOf(u.classroomId)?.name || 'Lớp'} · {u.date.split('-').reverse().join('/')} · {u.activityLabel}
                </span>
                {u.classroomId && (
                  <Link className="btn btn--sm btn--outline-primary" to={`/education/day-plans/${u.classroomId}?week=${mondayOf(u.date)}`}>
                    Mở giáo án ngày
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    );
  if (modal.type === 'edit')
    return (
      <Modal
        open
        title="Sửa học liệu"
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {LABELS.cancel}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!text.trim()}
              onClick={() =>
                act(
                  () =>
                    api.update(user, item.id, {
                      title: text.trim(),
                      ...(age ? { ageGroupId: age } : { clearAgeGroup: true }),
                      ...keptTags(),
                    }),
                  'Đã lưu học liệu',
                )
              }
            >
              {LABELS.save}
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="field">
            <label className="field__label" htmlFor={`${id}-title`}>
              Tên hiển thị
            </label>
            <input id={`${id}-title`} className="input" value={text} maxLength={255} onChange={(e) => setText(e.target.value)} />
          </div>
          <FilterSelect
            label="Nhóm tuổi"
            value={age}
            onChange={setAge}
            options={[{ value: '', label: 'Mọi nhóm tuổi' }, ...AGE_GROUPS.map((g) => ({ value: String(g.id), label: g.name }))]}
          />
          {(themeTag || goalTags.length > 0) && (
            <div className="field">
              <span className="field__label">Nhãn gợi ý (bấm để bỏ nhãn không đúng)</span>
              <div className="row gap-2 row--wrap">
                {themeTag && (
                  <Button size="sm" variant="ghost" aria-pressed={drop.theme} onClick={() => setDrop((d) => ({ ...d, theme: !d.theme }))}>
                    {drop.theme ? 'Giữ' : 'Bỏ'} chủ đề: {themeTag.name || 'chủ đề của giáo án'}
                  </Button>
                )}
                {goalTags.length > 0 && (
                  <Button size="sm" variant="ghost" aria-pressed={drop.goals} onClick={() => setDrop((d) => ({ ...d, goals: !d.goals }))}>
                    {drop.goals ? 'Giữ' : 'Bỏ'} {goalTags.length} nhãn MT
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  if (modal.type === 'class')
    return (
      <Modal
        open
        title="Chia sẻ cho lớp"
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {LABELS.cancel}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!classId}
              onClick={() => act(() => api.share(user, item.id, { scope: 'CLASS', classroomId: classId }), 'Đã chia sẻ cho lớp')}
            >
              Chia sẻ
            </Button>
          </>
        }
      >
        <p className="muted">Giáo viên của lớp thấy và gắn được học liệu này, không sửa hay xóa được.</p>
        <FilterSelect
          label="Lớp bạn đang dạy"
          value={classId}
          onChange={setClassId}
          options={[{ value: '', label: 'Chọn lớp' }, ...classes.map((c) => ({ value: String(c.id), label: c.name }))]}
        />
      </Modal>
    );
  if (modal.type === 'reject')
    return (
      <Modal
        open
        title="Trả lại đề nghị lên kho trường"
        onClose={close}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              {LABELS.cancel}
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!text.trim()}
              onClick={() => act(() => api.review(user, item.id, { approve: false, reason: text.trim() }), 'Đã trả lại đề nghị')}
            >
              Trả lại
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor={`${id}-reason`}>
            Lý do trả lại (bắt buộc)
          </label>
          <textarea id={`${id}-reason`} className="textarea" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </Modal>
    );
  if (modal.type === 'delete')
    return (
      <ConfirmationModal
        open
        danger
        title="Xóa học liệu khỏi kho?"
        message={`"${item.title}" và tệp đi kèm bị xóa hẳn, không khôi phục được.`}
        confirmLabel="Xóa học liệu"
        onClose={close}
        onConfirm={() => remove(item)}
      />
    );
  if (modal.type === 'inUse')
    return (
      <ConfirmationModal
        open
        title="Học liệu đang được dùng"
        message={`"${item.title}" đang gắn ở ${item.usageCount} mục hoạt động nên không xóa được. Ẩn khỏi kho để không hiện khi chọn; giáo án cũ vẫn xem được.`}
        confirmLabel="Ẩn khỏi kho"
        onClose={close}
        onConfirm={() => act(() => api.update(user, item.id, { hidden: true }), 'Đã ẩn khỏi kho')}
      />
    );
  return null;
}
