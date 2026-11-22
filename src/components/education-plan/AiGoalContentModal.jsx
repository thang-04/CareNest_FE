import { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, Sparkles } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/form/Checkbox';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { Notice } from '@/components/education-plan/eduUi';
import { getCurriculumContents, matchGoalContents } from '@/services/education-plan/educationPlanService';
import { goalContentStamp, requestGoalContents } from '@/models/education-plan/aiGoalContent.mjs';

export function AiGoalContentModal({ plan, allowed, current, ensureSaved, onApply, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const epoch = useRef(0);
  const controller = useRef(null);
  useEffect(() => () => { epoch.current += 1; controller.current?.abort(); }, []);
  const close = () => { epoch.current += 1; controller.current?.abort(); onClose(); };
  const stale = result && (!allowed || result.stamp !== goalContentStamp(plan));
  const lines = result?.groups.flatMap((group) => group.lines) || [];
  const count = lines.filter((line) => picked.has(line.key)).length;
  const toggle = (keys) => setPicked((old) => {
    const next = new Set(old);
    const remove = keys.every((key) => next.has(key));
    keys.forEach((key) => remove ? next.delete(key) : next.add(key));
    return next;
  });
  const ask = async () => {
    if (busy || !allowed) return;
    const ticket = ++epoch.current;
    controller.current?.abort();
    controller.current = new AbortController();
    const signal = controller.current.signal;
    const active = () => ticket === epoch.current && !signal.aborted;
    setBusy(true);
    setResult(null);
    setError('');
    const started = Date.now();
    try {
      const next = await requestGoalContents({ ensureSaved, current, active,
        request: (id) => matchGoalContents(id, { signal }),
        loadCatalog: (age) => getCurriculumContents(age, { signal }) });
      if (!active()) return;
      if (!next) { setError('Bản soạn hoặc quyền sửa đã thay đổi. Gọi lại AI để nhận gợi ý cho bản hiện tại.'); return; }
      setResult({ ...next, waitMs: Date.now() - started });
      setPicked(new Set(next.groups.flatMap((group) => group.lines.map((line) => line.key))));
    } catch (err) {
      if (!active()) return;
      setError(err?.errorCode === 8002 || err?.code === 'ECONNABORTED'
        ? 'AI trả lời quá lâu. Thử lại sau; bạn vẫn thêm nội dung bằng tay được.'
        : err?.errorCode === 8001 ? 'AI đang tắt hoặc chưa trả lời được. Bạn vẫn thêm nội dung bằng tay được.'
          : err?.message || 'Chưa lấy được gợi ý. Bạn vẫn thêm nội dung bằng tay được.');
    } finally { if (active()) setBusy(false); }
  };
  const apply = () => {
    if (stale || !count) return;
    if (onApply(result, picked) !== false) close();
    else setError('Bản soạn hoặc quyền sửa đã thay đổi. Gọi lại AI trước khi áp dụng.');
  };
  return <Modal open title="AI gợi ý nội dung cho mục tiêu" size="lg" onClose={close} footer={<>
    <Button onClick={close}>Hủy</Button>
    {result && <Button icon={RotateCcw} disabled={busy || !allowed} onClick={ask}>Gợi ý lại</Button>}
    {result ? <Button variant="primary" icon={Check} disabled={!count || stale || busy} onClick={apply} data-testid="ai-goal-content-apply">Áp dụng {count} nội dung</Button>
      : <Button variant="primary" icon={Sparkles} loading={busy} disabled={!allowed} onClick={ask} data-testid="ai-goal-content-ask">Gợi ý bằng AI</Button>}
  </>}><div className="stack" aria-busy={busy}>
    <AiDraftTag label="Gợi ý AI – duyệt trước khi áp dụng" />
    <p className="muted text-sm">AI chọn nội dung từ mục C cho mục tiêu chưa có nội dung. Bản đang soạn được lưu trước khi gọi AI. Bỏ chọn những dòng chưa phù hợp; Áp dụng thêm vào bản soạn, bấm Lưu để ghi lại.</p>
    {busy && <AiWorkingOverlay text="AI đang chọn nội dung theo từng lĩnh vực…" />}
    {error && <Notice>{error}</Notice>}
    {stale && <Notice>Bản soạn hoặc quyền sửa đã thay đổi. Gợi ý cũ không còn áp dụng được.</Notice>}
    {!!result?.failedDomains.length && <Notice>Lĩnh vực chưa lấy được gợi ý: {result.failedDomains.map((d) => d.name).join(', ')}. Bạn có thể áp dụng phần còn lại hoặc gợi ý lại.</Notice>}
    {result && !lines.length && <p className="muted text-sm">Chưa có nội dung phù hợp để thêm. Mục tiêu đã có nội dung được giữ nguyên; bạn vẫn dùng gợi ý mục C thủ công như thường.</p>}
    {result?.groups.map((group) => <section className="stack" key={group.goalId} aria-label={`Mục tiêu ${group.text}`}>
      <label className="row row--middle gap-2"><Checkbox checked={group.lines.every((l) => picked.has(l.key))} disabled={stale} onChange={() => toggle(group.lines.map((l) => l.key))} /><strong>{group.text}</strong></label>
      <span className="muted text-sm">{group.domain}</span>
      <ul className="stack">{group.lines.map((line) => <li key={line.key}><label className="row row--middle gap-2 text-sm"><Checkbox checked={picked.has(line.key)} disabled={stale} onChange={() => toggle([line.key])} /><span>{line.text}<span className="muted text-xs"> · căn cứ “{line.from}”</span></span></label></li>)}</ul>
    </section>)}
  </div></Modal>;
}
