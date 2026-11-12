import { useEffect, useRef, useState } from 'react';
import { Card, Notice } from './eduUi';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/form/FormField';
import { FileInput } from '@/components/form/FileInput';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Link2, Images } from '@/components/ui/icons';
import { LearningResourceViewer } from './LearningResourceViewer';
import { ResourceLinkForm } from './ResourceLinkForm';
import { ResourcePickerModal } from './ResourcePickerModal';
import { learningResourceService as api } from '@/services/education-plan/learningResourceService';
import { DAY_SECTIONS } from '@/models/education-plan/classPlan';
import {
  KIND_LABELS,
  MAX_PER_SECTION,
  MEDIA_ACCEPT,
  formatBytes,
  resourceKind,
  resourcesOf,
  sectionKey,
} from '@/models/education-plan/learningResources.mjs';

/**
 * BE:EDU-81/82 — học liệu theo từng mục hoạt động của một ngày trong kế hoạch giáo dục ngày. Mỗi mục: Tải lên, Dán link,
 * Chọn từ kho (dùng lại học liệu đã có). Học liệu tạo từ mục tự mang nhãn nhóm tuổi, chủ đề, MT của mục (BE:EDU-87).
 * tagsOf(sectionKey) ⇒ { themeId, themeName, goalIds }; ageGroupId để kho lọc mặc định cùng nhóm tuổi.
 */
export function DayResources({ user, docKey, date, editable, ageGroupId = null, tagsOf = () => ({}) }) {
  const [items, setItems] = useState([]);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  // Phần III thu gọn / mở rộng như các phần khác, "Thu gọn tất cả" bấm được (Tiền 13/11/2026)
  const [folded, setFolded] = useState(false);
  const [preview, setPreview] = useState(null);
  const [remove, setRemove] = useState(null);
  const [linkFor, setLinkFor] = useState('');
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
          setError('');
        }
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [user, docKey, version]);
  if (!docKey) return <Notice>Lưu kế hoạch giáo dục ngày trước khi gắn học liệu.</Notice>;
  const run = async (section, fn) => {
    setBusy(section);
    setError('');
    try {
      await fn();
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy('');
    }
  };
  const bindingOf = (section) => ({
    activityKey: sectionKey(date, section.key),
    activityLabel: section.label.replace(/^\d+\.\s*/, ''),
  });
  const upload = (section, input) =>
    run(section.key, async () => {
      const file = input.files?.[0];
      if (!file) return;
      const binding = bindingOf(section);
      // Cùng tệp + mục ⇒ giữ khóa gửi lại để BE không tạo trùng khi mạng chập chờn
      if (attempt.current?.file !== file || attempt.current?.key !== binding.activityKey)
        attempt.current = { file, key: binding.activityKey, id: crypto.randomUUID() };
      await api.upload(user, docKey, file, binding, attempt.current.id, tagsOf(section.key));
      attempt.current = null;
      input.value = '';
    });
  const addLink = (section, { url, title }) =>
    run(section.key, async () => {
      await api.addLink(user, docKey, { url, title, ...bindingOf(section), tags: tagsOf(section.key) });
      setLinkFor('');
    });
  const attach = (section, itemIds) => run(section.key, () => api.attach(user, docKey, { itemIds, ...bindingOf(section) }));

  return (
    <Card title="III. Học liệu theo mục hoạt động" collapsed={folded} onToggle={() => setFolded((v) => !v)}>
      <p className="muted">
        Ảnh tối đa 5 MB · Video 100 MB · PDF/slide/tệp khác 20 MB · link YouTube, Google Drive. Học liệu lưu vào kho để dùng lại ở
        ngày khác. Dùng khi bấm "Dạy học ngày này".
      </p>
      {error && <Notice tone="warn">{error}</Notice>}
      {DAY_SECTIONS.map((section) => {
        const bound = resourcesOf(items, date, section.key);
        const full = bound.length >= MAX_PER_SECTION;
        return (
          <section key={section.key} className="ga-media-unbound">
            <h3>{section.label}</h3>
            {editable && (
              <div className="ga-media-upload" role="group" aria-label={`Thêm học liệu cho ${section.label}`}>
                <FormField label="Tải lên ảnh, video, slide hoặc tệp">
                  <FileInput accept={MEDIA_ACCEPT} disabled={!!busy || full} onChange={(e) => upload(section, e.target)} />
                </FormField>
                <Button
                  variant="outline-primary"
                  size="sm"
                  icon={Link2}
                  disabled={!!busy || full}
                  aria-expanded={linkFor === section.key}
                  onClick={() => setLinkFor(linkFor === section.key ? '' : section.key)}
                >
                  Dán link
                </Button>
                <Button
                  variant="outline-primary"
                  size="sm"
                  icon={Images}
                  disabled={!!busy || full}
                  onClick={() => setPickFor(section)}
                >
                  Chọn từ kho
                </Button>
              </div>
            )}
            {full && editable && <p className="muted text-sm">Mục đã đủ {MAX_PER_SECTION} học liệu; gỡ bớt để thêm.</p>}
            {linkFor === section.key && (
              <ResourceLinkForm busy={busy === section.key} onSubmit={(v) => addLink(section, v)} onCancel={() => setLinkFor('')} />
            )}
            {busy === section.key && <p role="status">Đang lưu học liệu…</p>}
            {bound.length ? (
              <ul className="ga-resource-list">
                {bound.map((r) => (
                  <li key={r.id}>
                    <Button variant="ghost" onClick={() => setPreview(r)}>
                      {r.title || r.fileName} ·{' '}
                      {r.kind === 'LINK' ? KIND_LABELS[resourceKind(r)] : formatBytes(r.byteSize)}
                    </Button>
                    {editable && (
                      <Button variant="ghost" disabled={!!busy} onClick={() => setRemove(r)}>
                        Gỡ khỏi mục
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Chưa có học liệu.</p>
            )}
            {preview && bound.some((r) => r.id === preview.id) && <LearningResourceViewer user={user} docKey={docKey} resource={preview} />}
          </section>
        );
      })}
      {pickFor && (
        <ResourcePickerModal
          open
          user={user}
          sectionLabel={pickFor.label.replace(/^\d+\.\s*/, '')}
          context={{ docKey, activityKey: sectionKey(date, pickFor.key), ageGroupId, ...tagsOf(pickFor.key) }}
          onClose={() => setPickFor(null)}
          onAttach={(ids) => attach(pickFor, ids)}
        />
      )}
      <ConfirmationModal
        open={!!remove}
        title="Gỡ học liệu khỏi mục?"
        message="Học liệu không còn hiện khi dạy học ngày này. Học liệu vẫn ở trong kho và ở các ngày khác đang dùng."
        confirmLabel="Gỡ học liệu"
        onClose={() => setRemove(null)}
        error={error}
        onConfirm={() =>
          run(remove.activityKey, async () => {
            await api.detach(user, docKey, remove.id);
            setRemove(null);
            setPreview(null);
          })
        }
      />
    </Card>
  );
}
