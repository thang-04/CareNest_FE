import { useEffect, useState } from 'react';
import { Check, X } from '@/components/ui/icons';
import { SidePanel } from '@/components/ui/SidePanel';
import { LoadingState } from '@/components/ui/States';
import { getClassDocChecks } from '@/services/education-plan/educationPlanService';

/** Khung bên phải trang giáo án ngày (BE:EDU-96): tiêu chí gửi duyệt do BE kiểm, không dùng AI. */
export function ReviewAssistPanel({ open, onClose, dossierKey }) {
  const [checks, setChecks] = useState({ loading: false, data: null, error: '' });

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

  const data = checks.data;

  return (
    <SidePanel
      open={open}
      title={data ? `Kiểm tra kế hoạch giáo dục ngày (${data.passed}/${data.total})` : 'Kiểm tra kế hoạch giáo dục ngày'}
      onClose={onClose}
      wide
    >
      <div className="stack">
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
      </div>
    </SidePanel>
  );
}
