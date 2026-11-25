import { useEffect, useState } from 'react';
import { AiIcon, Check, Plus, X } from '@/components/ui/icons';
import { SidePanel } from '@/components/ui/SidePanel';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { LoadingState } from '@/components/ui/States';
import { getClassDocChecks, reviewDay } from '@/services/education-plan/educationPlanService';

/**
 * Khung bên phải trang giáo án ngày (BE:EDU-96): tab Kiểm tra (tiêu chí gửi duyệt do BE kiểm, không dùng AI) và tab Tóm tắt
 * (AI, chỉ gợi ý, không lưu). Mỗi ý tóm tắt "Đưa vào ghi chú" để gom nháp ghi chú Trả lại; AI không tự duyệt / trả lại.
 */
export function ReviewAssistPanel({ open, onClose, dossierKey, dayKey, canSummarize, canNote, noteDraft, onNoteDraft }) {
  const [tab, setTab] = useState('checks');
  const [checks, setChecks] = useState({ loading: false, data: null, error: '' });
  const [summary, setSummary] = useState({ loading: false, data: null, error: '' });

  useEffect(() => {
    if (!open || !dossierKey) return undefined;
    let alive = true;
    setChecks({ loading: true, data: null, error: '' });
    getClassDocChecks('dossier', dossierKey)
      .then((data) => alive && setChecks({ loading: false, data, error: '' }))
      .catch((err) => alive && setChecks({ loading: false, data: null, error: err?.message || 'Chưa tải được tiêu chí.' }));
    return () => {
      alive = false;
    };
  }, [open, dossierKey]);

  // Tóm tắt theo tuần đang mở: đổi tuần thì bỏ bản cũ
  useEffect(() => setSummary({ loading: false, data: null, error: '' }), [dayKey]);

  const summarize = async () => {
    setSummary({ loading: true, data: null, error: '' });
    try {
      setSummary({ loading: false, data: await reviewDay(dayKey), error: '' });
    } catch (err) {
      setSummary({ loading: false, data: null, error: err?.message || 'AI chưa trả lời được. Bạn vẫn duyệt bình thường.' });
    }
  };
  const addNote = (n) => onNoteDraft([noteDraft, `- ${n.label}: ${n.text}`].filter(Boolean).join('\n'));

  const data = checks.data;
  const tabs = [
    { key: 'checks', label: 'Kiểm tra', count: data ? `${data.passed}/${data.total}` : undefined },
    ...(canSummarize ? [{ key: 'summary', label: 'Tóm tắt (AI)' }] : []),
  ];

  return (
    <SidePanel open={open} title="Kiểm tra kế hoạch giáo dục ngày" onClose={onClose} wide>
      <div className="stack">
        <Tabs items={tabs} value={tab} onChange={setTab} ariaLabel="Kiểm tra và tóm tắt" />
        {tab === 'checks' && (
          <>
            {checks.loading && <LoadingState />}
            {checks.error && (
              <p className="field__error" role="alert">
                {checks.error}
              </p>
            )}
            {data && (
              <ul className="stack" aria-label="Tiêu chí gửi duyệt">
                {data.items.map((it) => (
                  <li key={it.key} className="row gap-2">
                    {it.ok ? (
                      <Check size={18} className="text-success" aria-label="Đạt" />
                    ) : (
                      <X size={18} className="text-danger" aria-label="Chưa đạt" />
                    )}
                    <div>
                      <div>{it.label}</div>
                      {!it.ok && it.message && <div className="text-danger text-sm">{it.message}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {tab === 'summary' && canSummarize && (
          <>
            <AiDraftTag label="Gợi ý của AI – chỉ để tham khảo, không lưu vào hồ sơ" />
            <div>
              <Button variant="outline-primary" size="sm" icon={AiIcon} loading={summary.loading} onClick={summarize}>
                {summary.data ? 'Tóm tắt lại' : 'Tóm tắt giáo án tuần này'}
              </Button>
            </div>
            {summary.error && (
              <p className="field__error" role="alert">
                {summary.error}
              </p>
            )}
            {summary.data && (
              <>
                <ul className="stack text-sm" aria-label="Tóm tắt">
                  {summary.data.summary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                {summary.data.notes.length > 0 && (
                  <>
                    <div className="section-title">Ý cần xem lại</div>
                    <ul className="stack" aria-label="Ý cần xem lại">
                      {summary.data.notes.map((n, i) => (
                        <li key={i} className="stack">
                          <div className="text-sm">
                            <strong>{n.label}</strong>: {n.text}
                          </div>
                          {canNote && (
                            <div>
                              <Button size="sm" icon={Plus} onClick={() => addNote(n)}>
                                Đưa vào ghi chú
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {canNote && noteDraft && (
              <p className="muted text-sm" role="status">
                Đã gom {noteDraft.split('\n').length} ý vào ghi chú; bấm Trả lại để xem và gửi.
              </p>
            )}
          </>
        )}
      </div>
    </SidePanel>
  );
}
