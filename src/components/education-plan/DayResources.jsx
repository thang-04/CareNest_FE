import { useEffect, useRef, useState } from 'react';
import { Card, Notice } from './eduUi';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/form/FormField';
import { FileInput } from '@/components/form/FileInput';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LearningResourceViewer } from './LearningResourceViewer';
import { learningResourceService as api } from '@/services/education-plan/learningResourceService';
import { DAY_SECTIONS } from '@/models/education-plan/classPlan';
import { MEDIA_ACCEPT, formatBytes, resourcesOf, sectionKey } from '@/models/education-plan/learningResources.mjs';

/** BE:EDU-81 — học liệu theo từng mục hoạt động của một ngày trong kế hoạch giáo dục ngày. */
export function DayResources({ user, docKey, date, editable }) {
  const [items, setItems] = useState([]);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [remove, setRemove] = useState(null);
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };
  const upload = (section, input) =>
    run(section.key, async () => {
      const file = input.files?.[0];
      if (!file) return;
      const binding = { activityKey: sectionKey(date, section.key), activityLabel: section.label.replace(/^\d+\.\s*/, '') };
      // Cùng tệp + mục ⇒ giữ khóa gửi lại để BE không tạo trùng khi mạng chập chờn
      if (attempt.current?.file !== file || attempt.current?.key !== binding.activityKey)
        attempt.current = { file, key: binding.activityKey, id: crypto.randomUUID() };
      await api.upload(user, docKey, file, binding, attempt.current.id);
      attempt.current = null;
      input.value = '';
    });
  return (
    <Card title="Học liệu theo mục hoạt động">
      <p className="muted">Ảnh tối đa 5 MB · Video 100 MB · PDF/slide/tệp khác 20 MB. Dùng khi bấm "Dạy học ngày này".</p>
      {error && <Notice tone="warn">{error}</Notice>}
      {DAY_SECTIONS.map((section) => {
        const bound = resourcesOf(items, date, section.key);
        return (
          <section key={section.key} className="ga-media-unbound">
            <h3>{section.label}</h3>
            {editable && (
              <FormField label="Thêm ảnh, video, slide hoặc tệp" className="ga-media-upload">
                <FileInput accept={MEDIA_ACCEPT} disabled={!!busy} onChange={(e) => upload(section, e.target)} />
              </FormField>
            )}
            {busy === section.key && <p role="status">Đang tải học liệu…</p>}
            {bound.length ? (
              <ul className="ga-resource-list">
                {bound.map((r) => (
                  <li key={r.id}>
                    <Button variant="ghost" onClick={() => setPreview(r)}>
                      {r.fileName} · {formatBytes(r.byteSize)}
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
            {preview && bound.some((r) => r.id === preview.id) && (
              <LearningResourceViewer user={user} docKey={docKey} resource={preview} />
            )}
          </section>
        );
      })}
      <ConfirmationModal
        open={!!remove}
        title="Gỡ học liệu khỏi mục?"
        message="Học liệu không còn hiện khi dạy học ngày này."
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
