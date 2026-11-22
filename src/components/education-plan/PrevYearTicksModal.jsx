import { useEffect, useMemo, useState } from 'react';
import { Check } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/form/Field';
import { Notice } from '@/components/education-plan/eduUi';
import { getPreviousYearTicks } from '@/services/education-plan/educationPlanService';
import { applyPicked, reviewLines } from '@/models/education-plan/aiThemeContent.mjs';
import { buildGroups, guessThemeMap, previewCounts } from '@/models/education-plan/prevYearTicks.mjs';

const REASONS = {
  NO_PREVIOUS_YEAR: 'Chưa có năm học trước năm học của kế hoạch này.',
  NO_APPROVED_PLAN: 'Năm học trước chưa có kế hoạch tổ đã ban hành cho nhóm tuổi này.',
};

/**
 * BE:EDU-104 "Lấy tick từ năm trước" (kế hoạch tổ): đọc tick kế hoạch tổ đã ban hành năm liền trước, ghép chủ đề (đoán sẵn,
 * sửa được) và nội dung trùng chữ cùng lĩnh vực, xem trước số tick rồi Áp dụng chỉ thêm tick vào bản đang soạn (chưa lưu).
 */
export function PrevYearTicksModal({ open, plan, planId, onApply, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [themeMap, setThemeMap] = useState({});
  const themes = (plan?.themes || []).filter((t) => (t.name || t.abbr || '').trim());

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setBusy(true);
    setError('');
    setData(null);
    getPreviousYearTicks(planId)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setThemeMap(guessThemeMap(plan?.themes, res?.themes));
      })
      .catch((err) => alive && setError(err?.message || 'Chưa tải được kế hoạch năm trước. Thử lại sau.'))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // Chỉ tải lại khi mở; tick đang soạn thay đổi không cần gọi lại BE
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, planId]);

  const { groups, unmatched } = useMemo(
    () => (data?.source ? buildGroups(plan, themeMap, data) : { groups: [], unmatched: 0 }),
    [plan, themeMap, data],
  );
  const counts = new Map(previewCounts(groups).map((c) => [c.themeId, c.count]));
  const tickCount = [...counts.values()].reduce((n, c) => n + c, 0);
  const options = (data?.themes || []).map((t) => ({ value: String(t.id), label: t.name }));

  const apply = () => {
    const { domains, added } = applyPicked(plan, groups, new Set(reviewLines(groups).map((l) => l.key)));
    onApply(domains, added);
    onClose();
  };

  return (
    <Modal
      open={open}
      size="lg"
      title="Lấy tick từ năm trước"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" icon={Check} disabled={!tickCount} onClick={apply} data-testid="prev-year-ticks-apply">
            Áp dụng {tickCount} tick
          </Button>
        </>
      }
    >
      <div className="stack">
        {busy && <p className="muted text-sm">Đang tải kế hoạch năm trước…</p>}
        {error && <Notice>{error}</Notice>}
        {data && !data.source && <Notice>{REASONS[data.reason] || 'Không có kế hoạch năm trước để lấy tick.'}</Notice>}
        {data?.source && (
          <>
            <p className="muted text-sm">
              Nguồn: kế hoạch tổ đã ban hành năm học {data.source.schoolYearName}. Chọn chủ đề năm trước tương ứng với từng chủ đề năm
              nay; nội dung trùng chữ trong cùng lĩnh vực được tick thêm, tick đang có giữ nguyên.
            </p>
            {!themes.length && <Notice>Chưa có chủ đề nào để lấy tick.</Notice>}
            {themes.map((t) => (
              <div key={t.id} className="row row--middle row--wrap gap-2">
                <SelectField
                  label={t.name || t.abbr}
                  value={themeMap[String(t.id)] || ''}
                  options={options}
                  placeholder="Không lấy"
                  onChange={(e) => setThemeMap((m) => ({ ...m, [String(t.id)]: e.target.value }))}
                  data-testid={`prev-year-theme-${t.id}`}
                />
                <span className="muted text-sm nowrap">+{counts.get(String(t.id)) || 0} tick</span>
              </div>
            ))}
            {unmatched > 0 && (
              <p className="muted text-sm" data-testid="prev-year-ticks-unmatched">
                {unmatched} nội dung năm trước không có câu trùng trong kế hoạch này nên bỏ qua.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
