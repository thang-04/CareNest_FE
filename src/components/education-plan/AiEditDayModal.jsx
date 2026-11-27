import { useState } from 'react';
import { Check, Sparkles } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { TextAreaField } from '@/components/form/Field';
import { Checkbox } from '@/components/form/Checkbox';
import { Notice } from '@/components/education-plan/eduUi';
import { editDayByRequest } from '@/services/education-plan/educationPlanService';

/**
 * BE:EDU-95 "Sửa theo yêu cầu": cô gõ một câu, AI trả các ô cũ → mới; cô chọn ô rồi bấm Áp dụng (chưa lưu, như sửa tay).
 * AI đọc bản đã lưu nên cần Lưu trước; ô cô sửa sau đó không bị ghi đè (applyCellChanges bỏ qua).
 */
export function AiEditDayModal({ open, docKey, unsaved, onApply, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changes, setChanges] = useState(null);
  const [picked, setPicked] = useState(new Set());

  const close = () => {
    setChanges(null);
    setError('');
    onClose();
  };
  const ask = async () => {
    if (!prompt.trim()) return setError('Nhập yêu cầu, ví dụ: đổi bài thơ sang chủ đề giao thông.');
    setBusy(true);
    setError('');
    try {
      const res = await editDayByRequest(docKey, prompt.trim());
      setChanges(res.changes || []);
      setPicked(new Set((res.changes || []).map((c) => c.path)));
    } catch (err) {
      setError(err?.message || 'AI chưa trả lời được. Bạn vẫn sửa tay bình thường.');
    } finally {
      setBusy(false);
    }
  };
  const toggle = (path) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <Modal
      open={open}
      size="lg"
      title="Sửa theo yêu cầu (AI)"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Hủy</Button>
          {changes ? (
            <Button
              variant="primary"
              icon={Check}
              disabled={!picked.size}
              onClick={() => {
                onApply(changes.filter((c) => picked.has(c.path)));
                close();
              }}
            >
              Áp dụng {picked.size} ô
            </Button>
          ) : (
            <Button variant="primary" icon={Sparkles} loading={busy} disabled={unsaved} onClick={ask}>
              Gợi ý thay đổi
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        <AiDraftTag />
        {unsaved && <Notice tone="info">Bấm Lưu trước: AI đọc giáo án đã lưu của tuần này.</Notice>}
        <TextAreaField
          label="Yêu cầu"
          rows={2}
          maxLength={500}
          value={prompt}
          placeholder="Ví dụ: đổi bài thơ sang chủ đề giao thông"
          onChange={(e) => {
            setPrompt(e.target.value);
            setChanges(null);
          }}
        />
        {busy && <AiWorkingOverlay lock text="AI đang sửa giáo án theo yêu cầu…" />}
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        {changes && changes.length === 0 && <p className="muted text-sm">AI không đề xuất ô nào cần đổi.</p>}
        {changes?.length > 0 && (
          <ul className="stack" aria-label="Các ô AI đề xuất đổi">
            {changes.map((c) => (
              <li key={c.path}>
                <label className="row row--middle gap-2 text-sm">
                  <Checkbox checked={picked.has(c.path)} onChange={() => toggle(c.path)} />
                  <strong>{c.label}</strong>
                </label>
                <ol className="ga-history-diff">
                  {c.before && (
                    <li className="ga-history-line ga-history-line--del">
                      <span className="ga-history-line__mark" aria-hidden>
                        −
                      </span>
                      <del>{c.before}</del>
                    </li>
                  )}
                  <li className="ga-history-line ga-history-line--add">
                    <span className="ga-history-line__mark" aria-hidden>
                      +
                    </span>
                    <ins>{c.after}</ins>
                  </li>
                </ol>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
