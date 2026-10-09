import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Info, MagicWand, PushPin, Shuffle, WarningCircle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { Breadcrumb, ErrorState, LoadingState, Spinner } from '@/components';
import { getAppearance, saveAppearance } from '@/services/appearance/appearanceService';
import { APPEARANCE_MODE, APPEARANCE_MODE_LABELS, SCENES, sceneById, sceneUrl } from '@/models/appearance/scenes';
import { pickScene } from '@/utils/appearance/pickScene';
import { canEditAppearance } from '@/utils/appearance/appearancePermissions';
import { acCrumbs } from '@/utils/account/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/appearance.css';

const MODES = [
  {
    id: APPEARANCE_MODE.AUTO,
    icon: MagicWand,
    desc: 'Tết, Trung thu, khai giảng dùng tranh của dịp; sau 18 giờ dùng tranh đêm; còn lại theo mùa.',
  },
  {
    id: APPEARANCE_MODE.DAILY_RANDOM,
    icon: Shuffle,
    desc: 'Mỗi ngày đổi một tranh trong các tranh đang bật, cả trường thấy cùng một tranh.',
  },
  { id: APPEARANCE_MODE.FIXED, icon: PushPin, desc: 'Luôn dùng một tranh được ghim, không tự đổi.' },
];

const OCCASION_LABELS = { tet: 'Tết', midAutumn: 'Trung thu', schoolOpening: 'Khai giảng' };
const SEASON_LABELS = { summer: 'Mùa hè', autumn: 'Mùa thu' };

const sceneTags = (s) => [s.time === 'night' ? 'Đêm' : 'Ngày', SEASON_LABELS[s.season], OCCASION_LABELS[s.occasion]].filter(Boolean);

const toForm = (cfg) => ({ mode: cfg.mode, pinnedSceneId: cfg.pinnedSceneId, enabledSceneIds: [...cfg.enabledSceneIds] });
const sameForm = (a, b) =>
  a.mode === b.mode && a.pinnedSceneId === b.pinnedSceneId && [...a.enabledSceneIds].sort().join() === [...b.enabledSceneIds].sort().join();

/** Tùy chỉnh tranh nền chung của trường: chọn chế độ, bật/tắt tranh, ghim tranh. HT/PHT được lưu, vai trò khác chỉ xem. */
export default function AppearancePage() {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = canEditAppearance(user);
  const { data, setData, loading, error, reload } = useAsync(() => getAppearance(user), [user.id]);
  const [form, setForm] = useState(null);
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const previewId = useMemo(() => (form ? pickScene(form, new Date()) : null), [form]);

  if (loading && !form) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!form) return null;

  const dirty = !sameForm(form, toForm(data));
  const isFixed = form.mode === APPEARANCE_MODE.FIXED;
  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setServerError('');
  };
  const toggleScene = (id) =>
    update({
      enabledSceneIds: form.enabledSceneIds.includes(id) ? form.enabledSceneIds.filter((x) => x !== id) : [...form.enabledSceneIds, id],
    });
  // Ghim một tranh đang tắt thì bật luôn tranh đó
  const pinScene = (id) =>
    update({
      pinnedSceneId: id,
      enabledSceneIds: form.enabledSceneIds.includes(id) ? form.enabledSceneIds : [...form.enabledSceneIds, id],
    });

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveAppearance(form, user);
      setData(saved);
      toast.success('Đã lưu giao diện cho cả trường.');
    } catch (err) {
      const details = err.details && typeof err.details === 'object' ? Object.values(err.details) : [];
      setServerError(details[0] || err.message || 'Chưa lưu được giao diện. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={acCrumbs('Tùy chỉnh giao diện')} />
      <div className="page__head ap-head" style={{ '--scene-bg': `url('${sceneUrl(previewId)}')` }}>
        <div>
          <h1 className="page__title">Tùy chỉnh giao diện</h1>
          <p className="ap-head__meta">
            Hôm nay hiển thị: <b>{sceneById(previewId)?.name}</b>
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="alert alert--info">
          <Info size={18} />
          <div>Chỉ Hiệu trưởng và Phó hiệu trưởng được đổi giao diện của trường. Bạn đang ở chế độ xem.</div>
        </div>
      )}
      {serverError && (
        <div className="alert alert--danger" role="alert">
          <WarningCircle size={18} />
          <div>{serverError}</div>
        </div>
      )}

      <section className="card">
        <div className="card__body">
          <h2 className="ap-section__title">Cách chọn tranh</h2>
          <div className="ap-modes" role="radiogroup" aria-label="Cách chọn tranh">
            {MODES.map(({ id, icon: Icon, desc }) => (
              <label key={id} className={`ap-mode ${form.mode === id ? 'is-active' : ''}`}>
                <input
                  type="radio"
                  name="appearance-mode"
                  value={id}
                  checked={form.mode === id}
                  disabled={!canEdit}
                  onChange={() => update({ mode: id })}
                />
                <span className="ap-mode__icon">
                  <Icon size={20} />
                </span>
                <span className="ap-mode__name">{APPEARANCE_MODE_LABELS[id]}</span>
                <span className="ap-mode__desc">{desc}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__body">
          <div className="ap-section__head">
            <h2 className="ap-section__title">Bộ tranh</h2>
            <span className="muted text-sm">
              Đang bật {form.enabledSceneIds.length}/{SCENES.length}
              {isFixed ? ' · bấm Ghim để chọn tranh cố định' : ''}
            </span>
          </div>
          <div className="ap-grid">
            {SCENES.map((s) => {
              const enabled = form.enabledSceneIds.includes(s.id);
              const pinned = isFixed && form.pinnedSceneId === s.id;
              return (
                <article key={s.id} className={`ap-scene ${enabled ? '' : 'is-off'} ${pinned ? 'is-pinned' : ''}`}>
                  <div className="ap-scene__thumb">
                    <img src={sceneUrl(s.id)} alt={s.name} loading="lazy" />
                    {s.id === previewId && (
                      <span className="ap-scene__today">
                        <CheckCircle size={14} /> Hôm nay
                      </span>
                    )}
                  </div>
                  <div className="ap-scene__body">
                    <div className="ap-scene__name">{s.name}</div>
                    <div className="ap-scene__tags">
                      {sceneTags(s).map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="ap-scene__actions">
                      <label className="ap-switch">
                        <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={() => toggleScene(s.id)} />
                        <span className="ap-switch__track" aria-hidden="true" />
                        {enabled ? 'Đang dùng' : 'Đã tắt'}
                      </label>
                      {isFixed && (
                        <button
                          type="button"
                          className={`btn btn--sm ${pinned ? 'btn--primary' : ''}`}
                          aria-pressed={pinned}
                          disabled={!canEdit}
                          onClick={() => pinScene(s.id)}
                        >
                          <PushPin size={14} /> {pinned ? 'Đã ghim' : 'Ghim'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {data.updatedAt && (
            <p className="muted text-sm ap-updated">
              Cập nhật lần cuối {formatDateTime(data.updatedAt)} bởi {data.updatedBy}
            </p>
          )}
        </div>
      </section>

      {canEdit && (
        <div className="page-actions">
          <span className="muted text-sm">{dirty ? 'Có thay đổi chưa lưu' : 'Chưa có thay đổi'}</span>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn" disabled={!dirty || busy} onClick={() => update(toForm(data))}>
              Hoàn tác
            </button>
            <button type="button" className="btn btn--primary" disabled={!dirty || busy} onClick={save}>
              {busy && <Spinner small />} Lưu giao diện
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
