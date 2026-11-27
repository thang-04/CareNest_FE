import { useMemo, useState } from 'react';
import { Check, RotateCcw, Sparkles } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/education-plan/useAiRun';
import { TextAreaField } from '@/components/form/Field';
import { Checkbox } from '@/components/form/Checkbox';
import { Notice } from '@/components/education-plan/eduUi';
import { matchThemeContents } from '@/services/education-plan/educationPlanService';
import { applyPicked, groupMatches, reviewLines, themeCount } from '@/models/education-plan/aiThemeContent.mjs';

const AI_OFF = 8001;
const AI_TIMEOUT = 8002;
const aiError = (err) => {
  if (err?.errorCode === AI_TIMEOUT || err?.code === 'ECONNABORTED')
    return 'AI trả lời quá lâu. Thử lại sau ít phút; bạn vẫn tick tay bình thường.';
  if (err?.errorCode === AI_OFF) return 'AI đang tắt hoặc chưa trả lời được. Bạn vẫn tick tay bình thường.';
  return err?.message || 'AI chưa trả lời được. Bạn vẫn tick tay bình thường.';
};

/**
 * BE:EDU-103 "AI gom nội dung vào chủ đề" (kế hoạch tổ): gõ vài ý cho từng chủ đề → AI gợi ý → duyệt theo chủ đề / căn cứ
 * → Áp dụng chỉ thêm tick vào bản đang soạn (chưa lưu). AI đọc bản đã lưu nên ensureSaved() lưu trước (EDU-22), trả id
 * kế hoạch hoặc null khi lưu lỗi (khi đó không gọi AI).
 */
export function AiThemeContentModal({ open, plan, ensureSaved, onApply, onClose }) {
  const [requests, setRequests] = useState({});
  const [busy, setBusy] = useState(false);
  const aiRun = useAiRun();
  const cancelAi = () => {
    aiRun.cancel();
    setBusy(false);
  };
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const themes = (plan?.themes || []).filter((t) => (t.name || t.abbr || '').trim());
  const branchNames = (themeId) =>
    (plan?.branchTemplates || [])
      .filter((b) => String(b.themeId) === String(themeId) && b.name?.trim())
      .map((b) => b.name.trim())
      .join('; ');
  // Gom theo bản đang soạn mới nhất (id nội dung có thể đổi sau lần Lưu ngay trước khi gọi AI)
  const groups = useMemo(() => (result ? groupMatches(plan, result.matches) : []), [plan, result]);
  const lines = reviewLines(groups);
  const tickCount = lines.filter((l) => picked.has(l.key)).reduce((n, l) => n + l.ids.length, 0);

  const close = () => {
    setResult(null);
    setError('');
    onClose();
  };
  const ask = async () => {
    setBusy(true);
    setError('');
    const startedAt = Date.now();
    const live = aiRun.begin();
    try {
      const planId = await ensureSaved();
      if (!live()) return;
      if (!planId) {
        setError('Chưa lưu được kế hoạch nên chưa gọi AI. Sửa lỗi lưu ở đầu trang rồi thử lại.');
        return;
      }
      const body = {
        themes: themes
          .filter((t) => /^\d+$/.test(String(t.id)) && requests[t.id]?.trim())
          .map((t) => ({ themeId: Number(t.id), request: requests[t.id].trim() })),
      };
      const res = await matchThemeContents(planId, body);
      if (!live()) return;
      const next = { matches: res?.matches || [], failedDomains: res?.failedDomains || [], waitMs: Date.now() - startedAt };
      setResult(next);
      setPicked(new Set(reviewLines(groupMatches(plan, next.matches)).map((l) => l.key)));
    } catch (err) {
      if (live()) setError(aiError(err));
    } finally {
      if (live()) setBusy(false);
    }
  };
  const toggle = (keys) =>
    setPicked((s) => {
      const next = new Set(s);
      const on = keys.every((k) => next.has(k));
      keys.forEach((k) => (on ? next.delete(k) : next.add(k)));
      return next;
    });
  const apply = () => {
    const { domains } = applyPicked(plan, groups, picked);
    onApply(domains, {
      suggested: lines.length,
      kept: lines.filter((l) => picked.has(l.key)).length,
      failedDomains: result.failedDomains.length,
      waitMs: result.waitMs,
    });
    close();
  };

  return (
    <Modal
      open={open}
      size="lg"
      title="AI gom nội dung vào chủ đề"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Hủy</Button>
          {result ? (
            <>
              <Button icon={RotateCcw} onClick={() => setResult(null)} data-testid="ai-theme-content-back">
                Sửa yêu cầu
              </Button>
              <Button variant="primary" icon={Check} disabled={!tickCount} onClick={apply} data-testid="ai-theme-content-apply">
                Áp dụng {tickCount} tick
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              icon={Sparkles}
              loading={busy}
              disabled={!themes.length}
              onClick={ask}
              data-testid="ai-theme-content-ask"
            >
              Gợi ý bằng AI
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        <AiDraftTag label="Gợi ý AI – tổ trưởng duyệt trước khi áp dụng" />
        {busy && <AiWorkingOverlay lock onCancel={cancelAi} text="AI đang gom nội dung theo từng lĩnh vực…" />}
        {error && <Notice>{error}</Notice>}
        {!result && (
          <>
            <p className="muted text-sm">
              Gõ vài ý cho chủ đề cần gom (không bắt buộc). Chủ đề để trống thì AI dựa vào tên chủ đề, sự kiện và tên nhánh. Bản đang soạn
              được lưu trước khi gọi AI.
            </p>
            {!themes.length && <Notice>Chưa có chủ đề nào để gom nội dung.</Notice>}
            {themes.map((t) => (
              <TextAreaField
                key={t.id}
                label={t.name || t.abbr}
                rows={2}
                maxLength={500}
                value={requests[t.id] || ''}
                placeholder={branchNames(t.id) || 'Ví dụ: hoạt động, trò chơi, bài hát tổ định dạy trong chủ đề này'}
                onChange={(e) => setRequests((r) => ({ ...r, [t.id]: e.target.value }))}
                data-testid={`ai-theme-request-${t.id}`}
              />
            ))}
          </>
        )}
        {result?.failedDomains.length > 0 && (
          <div className="row row--middle row--wrap gap-2">
            <Notice>Lĩnh vực chưa gom được: {result.failedDomains.map((d) => d.name).join(', ')}.</Notice>
            <Button size="sm" icon={RotateCcw} loading={busy} onClick={ask} data-testid="ai-theme-content-retry">
              Thử lại
            </Button>
          </div>
        )}
        {result && !groups.length && (
          <p className="muted text-sm">
            AI không tìm thấy nội dung nào chắc chắn thuộc chủ đề (hoặc đã tick hết). Bạn tick tay như thường.
          </p>
        )}
        {groups.map((g) => {
          const groupKeys = g.sources.flatMap((s) => s.lines.map((l) => l.key));
          return (
            <section key={g.themeId} className="stack" aria-label={`Chủ đề ${g.name}`}>
              <label className="row row--middle gap-2">
                <Checkbox checked={groupKeys.every((k) => picked.has(k))} onChange={() => toggle(groupKeys)} />
                <strong>{g.name}</strong>
                <span className="muted text-sm">{groupKeys.length} nội dung</span>
              </label>
              {g.sources.map((s) => {
                const keys = s.lines.map((l) => l.key);
                return (
                  <div key={s.from} className="stack">
                    <label className="row row--middle gap-2 text-sm">
                      <Checkbox checked={keys.every((k) => picked.has(k))} onChange={() => toggle(keys)} />
                      <span>← {s.from}</span>
                    </label>
                    <ul className="stack" aria-label={`Gợi ý theo "${s.from}"`}>
                      {s.lines.map((l) => (
                        <li key={l.key}>
                          <label className="row row--middle gap-2 text-sm">
                            <Checkbox checked={picked.has(l.key)} onChange={() => toggle([l.key])} />
                            <span>{l.text}</span>
                            <span className="muted text-xs nowrap">đang ở {themeCount(plan, l.text, groups, picked)} chủ đề</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
