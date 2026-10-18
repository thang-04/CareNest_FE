import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, FlaskConical, Pencil, Printer, Sun, Sunset, Tag, Timer } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFoodSampleLog, useKitchenCampus } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, Modal, PrintToolbar } from '@/components';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import { SampleBookPrint, SampleLabelsPrint } from '@/components/kitchen/FoodSamplePrint';
import { destroyFoodSample, saveFoodSample } from '@/services/kitchen/kitchenService';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
const dm = (iso) => (iso ? formatDate(iso.slice(0, 10)).slice(0, 5) : '');
const statusChip = (m) =>
  m.status === 'SAVED' ? (
    <span className="chip chip--green">Đã lưu {hhmm(m.takenAt)}</span>
  ) : m.status === 'DESTROYED' ? (
    <span className="chip chip--gray">Đã hủy {hhmm(m.destroyedAt)}</span>
  ) : (
    <span className="chip chip--gray">Chưa lưu</span>
  );

/** Một bữa: trạng thái, giờ lấy, người lưu và bảng món (Mẫu 5). Bếp nhập khi chưa lưu hoặc bấm Sửa. */
function MealCard({ meal, date, campusId, canEdit, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const editableMeal = canEdit && meal.status !== 'DESTROYED';
  const [editing, setEditing] = useState(editableMeal && meal.status === 'TODO');
  const [takenAt, setTakenAt] = useState(hhmm(meal.takenAt));
  const [dishes, setDishes] = useState(meal.dishes);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTakenAt(hhmm(meal.takenAt));
    setDishes(meal.dishes);
    setEditing(editableMeal && meal.status === 'TODO');
    setErrors({});
  }, [meal, editableMeal]);

  const setDish = (i, k, v) => setDishes((list) => list.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const save = async () => {
    setSaving(true);
    try {
      await saveFoodSample({ campusId, date, session: meal.session, takenAt, dishes }, user);
      toast.success(`Đã lưu mẫu ${MEAL_SESSION_LABELS[meal.session].toLowerCase()}.`);
      onSaved();
    } catch (err) {
      setErrors(err.status === 422 && err.details && typeof err.details === 'object' ? err.details : {});
      toast.error(err.message || 'Không lưu được. Vui lòng thử lại.', 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };
  const Icon = meal.session === 'LUNCH' ? Sun : Sunset;
  const cell = (i, k, placeholder, cls = '') =>
    editing ? (
      <input
        className={`input ${cls} ${errors[`dishes.${i}.${k}`] ? 'input--error' : ''}`}
        value={dishes[i][k] || ''}
        placeholder={placeholder}
        aria-label={`${placeholder} ${dishes[i].name}`}
        title={errors[`dishes.${i}.${k}`]}
        onChange={(e) => setDish(i, k, e.target.value)}
      />
    ) : (
      dishes[i][k] || <span className="muted">—</span>
    );

  return (
    <section className="card">
      <div className="card__body kb-meal">
        <div className="kb-meal__head">
          <h3>
            <Icon size={18} aria-hidden="true" /> {MEAL_SESSION_LABELS[meal.session]}
            {meal.servings != null ? ` · ${meal.servings} suất` : ''}
          </h3>
          {statusChip(meal)}
        </div>
        <div className="kb-kv">
          <span>
            Giờ lấy{' '}
            {editing ? (
              <input
                type="time"
                className={`input kb-kv__time ${errors.takenAt ? 'input--error' : ''}`}
                value={takenAt}
                aria-label="Giờ lấy mẫu"
                onChange={(e) => setTakenAt(e.target.value)}
              />
            ) : (
              <b>{meal.takenAt ? `${hhmm(meal.takenAt)} ${dm(meal.takenAt)}` : '—'}</b>
            )}
          </span>
          {meal.takenByName && (
            <span>
              Người lưu <b>{meal.takenByName}</b>
            </span>
          )}
          {meal.status === 'SAVED' && (
            <span>
              Hủy từ {hhmm(meal.destroyDueAt)} ngày {dm(meal.destroyDueAt)}
            </span>
          )}
          {meal.status === 'DESTROYED' && (
            <span>
              Người hủy <b>{meal.destroyedByName}</b> · {formatDateTime(meal.destroyedAt)}
            </span>
          )}
        </div>
        <div className="table-wrap">
          <table className="table table--compact kb-fc">
            <thead>
              <tr>
                <th>Món</th>
                <th>Khối lượng</th>
                <th>Dụng cụ</th>
                <th>Nhiệt độ</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d, i) => (
                <tr key={d.dishId}>
                  <td>{d.name}</td>
                  <td>{cell(i, 'weight', 'Khối lượng', 'kb-fs__short')}</td>
                  <td>{cell(i, 'container', 'Dụng cụ', 'kb-fs__wide')}</td>
                  <td>{cell(i, 'temperature', 'Nhiệt độ', 'kb-fs__short')}</td>
                  <td>{cell(i, 'note', 'Ghi chú', 'kb-fs__wide')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editableMeal && (
          <div className="kb-actions kb-actions--end">
            {editing ? (
              <>
                {meal.status !== 'TODO' && (
                  <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
                    Hủy sửa
                  </button>
                )}
                <button type="button" className="btn btn--primary" disabled={saving} onClick={save}>
                  {saving ? 'Đang lưu…' : 'Lưu mẫu'}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Sửa
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Sổ lưu mẫu thức ăn (khảo sát 18/10/2026, S10; bố cục B): mỗi bữa một thẻ, cột phải "Chờ ghi hủy" và "In biểu mẫu".
 * Theo QĐ 1246/QĐ-BYT: lưu mẫu từng món, hủy sau ít nhất 24 giờ. Không chặn bước nào của bếp.
 */
export default function FoodSampleLogPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const { campusId, setCampusId, canPick } = useKitchenCampus(md.campuses[0]?.id);
  const { data, loading, error, reload } = useFoodSampleLog(campusId, date);
  const [printing, setPrinting] = useState(null);
  const [busy, setBusy] = useState(null);
  const sheetRef = useRef(null);
  const campus = md.campusById(campusId);

  const destroy = async (p) => {
    setBusy(`${p.date}|${p.session}`);
    try {
      await destroyFoodSample({ campusId, date: p.date, session: p.session }, user);
      toast.success(`Đã ghi hủy mẫu ${MEAL_SESSION_LABELS[p.session].toLowerCase()} ${formatDate(p.date)}.`);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không lưu được. Vui lòng thử lại.', 'Không ghi hủy được');
    } finally {
      setBusy(null);
    }
  };

  let main;
  if (md.error && !campusId) main = <ErrorState error={md.error} onRetry={md.reload} />;
  else if (!campusId || (!data && !error) || (loading && !data)) main = <LoadingState />;
  else if (error) main = <ErrorState error={error} onRetry={reload} />;
  else if (!data?.meals?.length)
    main = (
      <section className="card">
        <EmptyState
          icon={FlaskConical}
          title="Ngày này không có bữa ăn"
          description={`Chưa có thực đơn công bố cho ${formatDate(date)}.`}
        />
      </section>
    );
  else
    main = data.meals.map((m) => (
      <MealCard
        key={`${date}-${m.session}`}
        meal={m}
        date={date}
        campusId={campusId}
        canEdit={data.canEdit}
        onSaved={() => reload({ silent: true })}
      />
    ));

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.foodSamples)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Sổ lưu mẫu thức ăn</h1>
          <p className="page__desc">Lưu mẫu từng bữa và hủy mẫu sau ít nhất 24 giờ.</p>
        </div>
      </div>
      <div className="kb-toolbar kb-toolbar--center">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        <KbCampusFilter campusId={campusId} onChange={setCampusId} canPick={canPick} />
      </div>
      <div className="kb-split">
        <div className="kb-stack">{main}</div>
        <div className="kb-stack">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                <Timer size={18} /> Chờ ghi hủy
              </h2>
              {data?.pendingDestroy.length > 0 && <span className="chip chip--orange">{data.pendingDestroy.length}</span>}
            </div>
            <div className="card__body">
              {!data ? null : data.pendingDestroy.length === 0 ? (
                <p className="muted text-sm">Không có mẫu chờ hủy. Mẫu đủ 24 giờ sẽ hiện ở đây.</p>
              ) : (
                <ul className="kb-list">
                  {data.pendingDestroy.map((p) => (
                    <li key={`${p.date}-${p.session}`} className="kb-list__item">
                      <span className="kb-list__icon kb-list__icon--warn" aria-hidden="true">
                        <Timer size={16} />
                      </span>
                      <div className="kb-list__main">
                        <b>
                          {MEAL_SESSION_LABELS[p.session]} {formatDate(p.date).slice(0, 5)}
                        </b>
                        <small>
                          Lấy {hhmm(p.takenAt)} · đủ 24 giờ lúc {hhmm(p.dueAt)} {dm(p.dueAt)}
                          {p.dishCount ? ` · ${p.dishCount} món` : ''}
                        </small>
                      </div>
                      {data.canEdit ? (
                        <button
                          type="button"
                          className="btn btn--sm"
                          disabled={busy === `${p.date}|${p.session}`}
                          onClick={() => destroy(p)}
                        >
                          Ghi hủy
                        </button>
                      ) : (
                        <span className="chip chip--orange">Chờ ghi hủy</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                <Printer size={18} /> In biểu mẫu
              </h2>
            </div>
            <div className="card__body kb-stack kb-stack--tight">
              <button
                type="button"
                className="btn btn--block"
                disabled={!data?.meals.some((m) => m.takenAt)}
                onClick={() => setPrinting('label')}
              >
                <Tag size={16} /> In nhãn Mẫu 4 (theo bữa)
              </button>
              <button type="button" className="btn btn--block" disabled={!data?.meals.length} onClick={() => setPrinting('book')}>
                <FileText size={16} /> In sổ Mẫu 5 (cả ngày)
              </button>
              <p className="text-xs muted">Theo QĐ 1246/QĐ-BYT. Ô ký để trống, ký tay sau khi in.</p>
            </div>
          </section>
        </div>
      </div>

      {data && (
        <Modal
          open={!!printing}
          onClose={() => setPrinting(null)}
          size="xl"
          className="kb-print-modal"
          title={printing === 'label' ? 'Nhãn mẫu thức ăn lưu (Mẫu 4)' : 'Sổ lưu và hủy mẫu (Mẫu 5)'}
          footer={
            <PrintToolbar sheetRef={sheetRef} fileBase={`${printing === 'label' ? 'Nhan_mau_4' : 'So_mau_5'}_${date}`} printLabel="In" />
          }
        >
          <div className="print-preview__paper">
            {printing === 'label' ? (
              <SampleLabelsPrint
                ref={sheetRef}
                log={{ ...data, meals: data.meals.filter((m) => m.takenAt) }}
                campusName={campus?.shortName || campus?.name}
              />
            ) : (
              <SampleBookPrint ref={sheetRef} log={data} campusName={campus?.shortName || campus?.name} />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
