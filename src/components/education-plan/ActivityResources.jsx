import { useEffect, useRef, useState } from 'react';
import { Card, Notice } from './eduUi';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LearningResourceViewer } from './LearningResourceViewer';
import { learningResourceService as api } from '@/services/education-plan/learningResourceService';
import { activitySignature, resourceMatches, formatBytes, MEDIA_ACCEPT } from '@/models/education-plan/learningResources.mjs';

export function ActivityResources({ user, doc, activities, editable, exists, onSave }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [preview, setPreview] = useState(null);
  const [remove, setRemove] = useState(null);
  const [signatureState, setSignatures] = useState({ rows: null, values: {} });
  const signatures = signatureState.rows === doc.rows ? signatureState.values : {};
  const attempt = useRef(null);
  const uploadInput = useRef(null);
  const activity = activities.find((a) => a.id === selected) || activities[0];
  useEffect(() => {
    let alive = true;
    Promise.all(Object.entries(doc.rows || {}).map(async ([id, row]) => [id, await activitySignature(row.activities)])).then(
      (entries) => alive && setSignatures({ rows: doc.rows, values: Object.fromEntries(entries) }),
    );
    return () => {
      alive = false;
    };
  }, [doc.rows]);
  useEffect(() => {
    if (!exists) return undefined;
    let alive = true;
    api
      .list(user, doc.id)
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
  }, [user, doc.id, exists, version]);
  const binding = activity && {
    activityKey: activity.id,
    activitySignature: signatures[activity.goalId],
    activityLabel: activity.text.slice(0, 1000),
  };
  const matches = (r, a) => resourceMatches(r, a, signatures[a.goalId]);
  const unbound = items.filter((r) => !activities.some((a) => matches(r, a)));
  const bound = activity ? items.filter((r) => matches(r, activity)) : [];
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const upload = () =>
    run(async () => {
      if (!file || !binding?.activitySignature) return;
      if (!(await onSave())) throw new Error('Lưu kế hoạch chủ đề thành công trước khi tải học liệu.');
      const bindingKey = JSON.stringify(binding);
      if (!attempt.current || attempt.current.file !== file || attempt.current.bindingKey !== bindingKey)
        attempt.current = { file, bindingKey, id: crypto.randomUUID() };
      await api.upload(user, doc.id, file, binding, attempt.current.id);
      attempt.current = null;
      setFile(null);
      if (uploadInput.current) uploadInput.current.value = '';
    });
  return (
    <Card title="Học liệu theo hoạt động">
      <p className="muted">
        Ảnh tối đa 5 MB · Video 100 MB · PDF/slide/tệp khác 20 MB. Học liệu dùng lại khi hoạt động được xếp vào tuần/ngày.
      </p>
      {error && <Notice tone="warn">{error}</Notice>}
      {!activities.length ? (
        <Notice>Nhập hoạt động giáo dục để gắn học liệu.</Notice>
      ) : (
        <>
          <label className="field">
            Hoạt động
            <select
              value={activity?.id || ''}
              onChange={(e) => {
                setSelected(e.target.value);
                setPreview(null);
              }}
              disabled={busy}
            >
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  MT{a.goalNo}: {a.text}
                </option>
              ))}
            </select>
          </label>
          {editable && (
            <div className="ga-media-upload">
              <label className="field">
                Chọn ảnh, video, slide hoặc tệp
                <input
                  ref={uploadInput}
                  type="file"
                  accept={MEDIA_ACCEPT}
                  disabled={busy}
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    attempt.current = null;
                  }}
                />
              </label>
              <button type="button" className="btn btn--primary" disabled={busy || !file || !binding?.activitySignature} onClick={upload}>
                {busy ? 'Đang xử lý…' : 'Lưu và tải học liệu'}
              </button>
            </div>
          )}
          <ul className="ga-resource-list">
            {bound.map((r) => (
              <li key={r.id}>
                <button type="button" className="btn btn--ghost" onClick={() => setPreview(r)}>
                  {r.fileName} · {formatBytes(r.byteSize)}
                </button>
                {editable && (
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => setRemove(r)}>
                    Gỡ khỏi hoạt động
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!bound.length && <p className="muted">Hoạt động này chưa có học liệu phù hợp với nội dung hiện tại.</p>}
          {preview && bound.some((r) => r.id === preview.id) && <LearningResourceViewer user={user} docKey={doc.id} resource={preview} />}
        </>
      )}
      {editable && !!unbound.length && (
        <section className="ga-media-unbound">
          <h3>Cần kiểm tra / gắn lại</h3>
          <p>Nội dung hoạt động đã thay đổi hoặc tệp đã được gỡ. Tệp vẫn được giữ trong chủ đề.</p>
          <ul className="ga-resource-list">
            {unbound.map((r) => (
              <li key={r.id}>
                <span>
                  {r.fileName} · trước đây: {r.activityLabel}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !binding?.activitySignature}
                  onClick={() =>
                    run(async () => {
                      if (!(await onSave())) throw new Error('Chưa lưu được kế hoạch.');
                      await api.bind(user, doc.id, r.id, binding);
                    })
                  }
                >
                  Gắn vào hoạt động đang chọn
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ConfirmationModal
        open={!!remove}
        title="Gỡ học liệu khỏi hoạt động?"
        message="Tệp vẫn được giữ ở phần cần gắn lại của chủ đề. Bạn có thể gắn lại khi cần."
        confirmLabel="Gỡ liên kết"
        onClose={() => setRemove(null)}
        error={error}
        onConfirm={() =>
          run(async () => {
            await api.detach(user, doc.id, remove.id);
            setRemove(null);
            setPreview(null);
          })
        }
      />
    </Card>
  );
}
