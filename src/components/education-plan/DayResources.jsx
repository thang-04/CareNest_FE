import { useEffect, useRef, useState } from 'react';
import { Card, Notice } from './eduUi';
import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RowMenu } from '@/components/ui/RowMenu';
import { SortButtons, SortHandle, SortableList, SortableRow } from '@/components/ui/Sortable';
import { Eye, FileImage, FileText, Link2, Plus, Trash2 } from '@/components/ui/icons';
import { LearningResourceViewer } from './LearningResourceViewer';
import { ResourcePickerModal } from './ResourcePickerModal';
import { learningResourceService as api } from '@/services/education-plan/learningResourceService';
import { DAY_SECTIONS } from '@/models/education-plan/classPlan';
import {
  KIND_LABELS,
  MAX_PER_SECTION,
  formatBytes,
  resourceKind,
  resourcesOf,
  sectionKey,
} from '@/models/education-plan/learningResources.mjs';

const KIND_ICONS = { image: FileImage, youtube: Link2, google: Link2 };
const sectionName = (section) => section.label.replace(/^\d+\.\s*/, '');

/**
 * BE:EDU-81/82 (spec 901) — học liệu theo từng mục hoạt động của một ngày trong kế hoạch giáo dục ngày. Mỗi mục một nút
 * "+ Thêm học liệu" mở hộp gộp (kho của tôi, Tải lên, Dán link); học liệu đã gắn hiện dạng thẻ, đổi thứ tự, xem, gỡ.
 * tagsOf(sectionKey) ⇒ { themeId, themeName, goalIds } gửi kèm khi tải lên / dán link / gắn (nhãn tự thêm, BE:EDU-87);
 * ageGroupId để kho lọc mặc định cùng nhóm tuổi.
 */
export function DayResources({ user, docKey, date, editable, ageGroupId = null, tagsOf = () => ({}) }) {
  const [items, setItems] = useState([]);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState({ section: '', text: '' });
  // Phần III thu gọn / mở rộng như các phần khác, "Thu gọn tất cả" bấm được (Tiền 13/11/2026)
  const [folded, setFolded] = useState(false);
  const [preview, setPreview] = useState(null);
  const [remove, setRemove] = useState(null);
  const [pickFor, setPickFor] = useState(null);
  const attempt = useRef(null);
  useEffect(() => {
    if (!docKey) return undefined;
    let alive = true;
    api
      .list(user, docKey)
      .then((rows) => {
        if (alive) {
          setItems(rows);
          setError({ section: '', text: '' });
        }
      })
      .catch((e) => alive && setError({ section: '', text: e.message }));
    return () => {
      alive = false;
    };
  }, [user, docKey, version]);
  if (!docKey) return <Notice>Lưu kế hoạch giáo dục ngày trước khi gắn học liệu.</Notice>;
  const run = async (section, fn) => {
    setBusy(section);
    setError({ section: '', text: '' });
    try {
      await fn();
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError({ section, text: e.message });
      return false;
    } finally {
      setBusy('');
    }
  };
  const bindingOf = (section) => ({ activityKey: sectionKey(date, section.key), activityLabel: sectionName(section) });
  const upload = (section, file) =>
    run(section.key, async () => {
      const binding = bindingOf(section);
      // Cùng tệp + mục ⇒ giữ khóa gửi lại để BE không tạo trùng khi mạng chập chờn
      if (attempt.current?.file !== file || attempt.current?.key !== binding.activityKey)
        attempt.current = { file, key: binding.activityKey, id: crypto.randomUUID() };
      await api.upload(user, docKey, file, binding, attempt.current.id, tagsOf(section.key));
      attempt.current = null;
    });
  const addLink = (section, { url, title }) =>
    run(section.key, () => api.addLink(user, docKey, { url, title, ...bindingOf(section), tags: tagsOf(section.key) }));
  const attach = (section, itemIds) =>
    run(section.key, () => api.attach(user, docKey, { itemIds, ...bindingOf(section), tags: tagsOf(section.key) }));
  // BE:EDU-82 — thứ tự học liệu trong mục = thứ tự xem/trình chiếu
  const move = (section, bound, from, to) => {
    const ids = bound.map((r) => r.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setItems((all) => [...all.filter((r) => !ids.includes(r.id)), ...ids.map((id) => bound.find((r) => r.id === id))]);
    run(section.key, () => api.reorder(user, docKey, { activityKey: sectionKey(date, section.key), ids }));
  };
  const nameOf = (r) => r.title || r.fileName;

  return (
    <Card title="III. Học liệu theo mục hoạt động" collapsed={folded} onToggle={() => setFolded((v) => !v)}>
      <p className="muted">
        Ảnh tối đa 5 MB · Video 100 MB · PDF/slide/tệp khác 20 MB · link YouTube, Google Drive. Học liệu thêm ở đây tự vào kho của bạn để
        dùng lại ở ngày khác, năm sau. Dùng khi bấm "Dạy học ngày này".
      </p>
      {error.text && !error.section && <Notice>{error.text}</Notice>}
      {DAY_SECTIONS.map((section) => {
        const bound = resourcesOf(items, date, section.key);
        const full = bound.length >= MAX_PER_SECTION;
        const name = sectionName(section);
        const sortable = editable && bound.length > 1;
        return (
          <section key={section.key} className="ga-media-unbound" aria-label={section.label}>
            <div className="ga-media-upload">
              <h3>{section.label}</h3>
              {editable && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  icon={Plus}
                  disabled={!!busy || full}
                  aria-label={`Thêm học liệu cho mục ${name}`}
                  onClick={() => setPickFor(section)}
                >
                  Thêm học liệu
                </Button>
              )}
            </div>
            {full && editable && <p className="muted text-sm">Mục đã đủ {MAX_PER_SECTION} học liệu; gỡ bớt để thêm.</p>}
            {busy === section.key && <p role="status">Đang lưu học liệu…</p>}
            {error.text && error.section === section.key && <Notice>{error.text}</Notice>}
            {bound.length ? (
              <SortableList
                ids={bound.map((r) => r.id)}
                disabled={!sortable || !!busy}
                labelOf={(i) => nameOf(bound[i])}
                onMove={(from, to) => move(section, bound, from, to)}
              >
                <ul className="ga-resource-list stack" aria-label={`Học liệu của mục ${name}`}>
                  {bound.map((r, at) => {
                    const kind = resourceKind(r);
                    const Icon = KIND_ICONS[kind] || FileText;
                    return (
                      <SortableRow key={r.id} id={r.id} as="li" className="file-row">
                        {sortable && <SortHandle label={nameOf(r)} />}
                        <Icon size={22} aria-hidden />
                        <div className="flex-1 min-w-0">
                          <span className="file-row__name">{nameOf(r)}</span>
                          <span className="muted text-sm">
                            {KIND_LABELS[kind]}
                            {r.kind !== 'LINK' && r.byteSize ? ` · ${formatBytes(r.byteSize)}` : ''}
                          </span>
                        </div>
                        <span className="row gap-1">
                          {sortable && <SortButtons index={at} label={nameOf(r)} />}
                          {editable ? (
                            <RowMenu
                              label={`Thao tác với ${nameOf(r)}`}
                              items={[
                                {
                                  label: preview?.id === r.id ? 'Ẩn xem' : 'Xem',
                                  icon: Eye,
                                  onClick: () => setPreview(preview?.id === r.id ? null : r),
                                },
                                { label: 'Gỡ khỏi mục', icon: Trash2, danger: true, disabled: !!busy, onClick: () => setRemove(r) },
                              ]}
                            />
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Eye}
                              aria-expanded={preview?.id === r.id}
                              aria-label={`Xem ${nameOf(r)}`}
                              onClick={() => setPreview(preview?.id === r.id ? null : r)}
                            >
                              {preview?.id === r.id ? 'Ẩn xem' : 'Xem'}
                            </Button>
                          )}
                        </span>
                      </SortableRow>
                    );
                  })}
                </ul>
              </SortableList>
            ) : (
              <p className="muted text-sm">Chưa có học liệu.</p>
            )}
            {preview && bound.some((r) => r.id === preview.id) && <LearningResourceViewer user={user} docKey={docKey} resource={preview} />}
          </section>
        );
      })}
      {pickFor && (
        <ResourcePickerModal
          user={user}
          sectionLabel={sectionName(pickFor)}
          room={MAX_PER_SECTION - resourcesOf(items, date, pickFor.key).length}
          busy={busy === pickFor.key}
          error={error.section === pickFor.key ? error.text : ''}
          context={{ docKey, activityKey: sectionKey(date, pickFor.key), ageGroupId, ...tagsOf(pickFor.key) }}
          onClose={() => setPickFor(null)}
          onAttach={(ids) => attach(pickFor, ids)}
          onUpload={(file) => upload(pickFor, file)}
          onAddLink={(link) => addLink(pickFor, link)}
        />
      )}
      <ConfirmationModal
        open={!!remove}
        title="Gỡ học liệu khỏi mục?"
        message="Học liệu không còn hiện khi dạy học ngày này. Học liệu vẫn ở trong kho của người tạo và ở các ngày khác đang dùng."
        confirmLabel="Gỡ học liệu"
        onClose={() => setRemove(null)}
        error={error.text}
        onConfirm={() =>
          run(remove.activityKey.split('#')[1], async () => {
            await api.detach(user, docKey, remove.id);
            setRemove(null);
            setPreview(null);
          })
        }
      />
    </Card>
  );
}
