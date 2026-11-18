import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarPlus, Check, Download, Printer, Send, ShoppingBasket, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useKitchenCampus, useWeeklyForecast } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, Button, ConfirmationModal, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { PrintPaperFit } from '@/components/print/PrintPaperFit';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { KbCampusFilter } from '@/components/kitchen/KitchenFilters';
import { WeekPicker } from '@/components/form/WeekPicker';
import { DryOrderTable, FreshOrderTable, SupplierChangeCard, WeekForecastGrid, weekLabel } from '@/components/kitchen/ForecastBlocks';
import { WeeklyOrderPrint } from '@/components/kitchen/WeeklyOrderPrint';
import { markWeeklyOrderSent, saveWeeklyForecast, setSupplierNotified } from '@/services/kitchen/kitchenService';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { weeklyOrderCsvRows } from '@/utils/kitchen/kitchenExport';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import { addDays, mondayOf, schoolWeekStart } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/kitchen.css';

/**
 * Dự trù & đi chợ theo tuần (khảo sát 18/10/2026, S1; bố cục A): tab "Dự trù tuần" (lưới suất lớp × ngày + phiếu đặt hàng
 * tuần) và tab "Báo NCC thay đổi". Số suất gợi ý, lượng đặt, chênh lệch do service tính; trang chỉ hiển thị và gửi ô sửa.
 */
export default function WeeklyForecastPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const today = todayInput();
  const thisWeek = schoolWeekStart(today);
  const weekStart = params.get('week') ? mondayOf(params.get('week')) : thisWeek;
  const tab = params.get('tab') === 'ncc' ? 'ncc' : 'tuan';
  const { campusId, setCampusId, canPick } = useKitchenCampus(md.campuses[0]?.id);
  const { data, loading, error, reload } = useWeeklyForecast(campusId, weekStart);
  const [orderTab, setOrderTab] = useState('tuoi');
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [notifiedOverride, setNotifiedOverride] = useState({});
  const sheetRef = useRef(null);

  // Đổi tuần hoặc cơ sở thì bỏ ô đang sửa
  useEffect(() => {
    setDraft({});
    setErrors({});
  }, [weekStart, campusId]);

  const go = (next) => setParams({ ...Object.fromEntries(params), ...next }, { replace: true });
  const campus = md.campusById(campusId);
  const canEdit = !!data?.canEdit;
  const ready = data?.status === 'READY';
  const dirty = Object.values(draft).some((byDate) => Object.keys(byDate).length);
  const nextWeek = addDays(weekStart, 7);
  const menuPublished = ready;
  // Mở bảng đi chợ ở hôm nay nếu hôm nay thuộc tuần đang xem, không thì ở ngày đầu tuần
  const dayInWeek = today >= weekStart && today <= addDays(weekStart, 4) ? today : weekStart;

  const changeCell = (classId, date, value) => {
    setDraft((d) => ({ ...d, [classId]: { ...d[classId], [date]: value } }));
    setErrors((e) => {
      const { [`${classId}|${date}`]: _drop, ...rest } = e;
      return rest;
    });
  };

  const save = async () => {
    const cells = {};
    Object.entries(draft).forEach(([classId, byDate]) =>
      Object.entries(byDate).forEach(([date, v]) => {
        cells[classId] ||= {};
        cells[classId][date] = v === '' ? '' : Number(v);
      }),
    );
    setSaving(true);
    try {
      await saveWeeklyForecast({ campusId, weekStart, cells }, user);
      toast.success('Đã lưu dự trù tuần.');
      setDraft({});
      setErrors({});
      reload({ silent: true });
    } catch (err) {
      setErrors(err.status === 422 && err.details && typeof err.details === 'object' ? err.details : {});
      toast.error(err.message || 'Không lưu được dự trù. Vui lòng thử lại.', 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    try {
      await markWeeklyOrderSent({ campusId, weekStart }, user);
      toast.success('Đã đánh dấu gửi phiếu đặt hàng tuần cho NCC.');
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || 'Không lưu được. Vui lòng thử lại.', 'Không đánh dấu được');
    } finally {
      setConfirmSend(false);
    }
  };

  // Ô tích đổi ngay trên màn hình (giữ trong notifiedOverride tới khi dữ liệu tải lại khớp); API nhận từng dòng nên gửi song song
  const setNotified = async (date, foodIds, notified) => {
    if (!foodIds.length) return;
    const keys = foodIds.map((id) => `${date}|${id}`);
    setNotifiedOverride((o) => ({ ...o, ...Object.fromEntries(keys.map((k) => [k, notified])) }));
    const results = await Promise.allSettled(
      foodIds.map((foodId) => setSupplierNotified({ campusId, weekStart, date, foodId, notified }, user)),
    );
    const failed = keys.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) {
      // Dòng lỗi trả về trạng thái đã lưu
      setNotifiedOverride((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !failed.includes(k))));
      const reason = results.find((r) => r.status === 'rejected').reason;
      toast.error(`${reason?.message || 'Không lưu được.'} ${failed.length}/${keys.length} dòng chưa lưu.`, 'Chưa lưu hết');
    }
    reload({ silent: true });
  };
  const toggleNotified = (date, foodId, notified) => setNotified(date, [foodId], notified);
  const toggleAllNotified = (date, lines, notified) =>
    setNotified(
      date,
      lines.filter((l) => (notifiedOverride[`${date}|${l.foodId}`] ?? l.notified) !== notified).map((l) => l.foodId),
      notified,
    );

  // Dữ liệu tải lại đã khớp ô vừa tích thì bỏ giá trị tạm
  useEffect(() => {
    const saved = Object.fromEntries((data?.changes || []).flatMap((g) => g.lines.map((l) => [`${g.date}|${l.foodId}`, l.notified])));
    setNotifiedOverride((o) => {
      const left = Object.entries(o).filter(([k, v]) => k in saved && saved[k] !== v);
      return left.length === Object.keys(o).length ? o : Object.fromEntries(left);
    });
  }, [data]);

  const totalOf = useMemo(() => Object.fromEntries((data?.days || []).map((d) => [d.date, d.total])), [data]);

  const head = (
    <div className="page__head">
      <div>
        <h1 className="page__title">Dự trù & đi chợ</h1>
      </div>
    </div>
  );

  const toolbar = (
    // Căn đáy: mọi ô có nhãn phía trên, phần không nhãn cao bằng ô nhập để thẳng hàng
    <div className="kb-toolbar">
      <div className="date-filter">
        Tuần
        <span className="date-filter__static">
          <WeekPicker value={weekStart} thisWeek={thisWeek} onChange={(week) => go({ week })} />
        </span>
      </div>
      <KbCampusFilter campusId={campusId} onChange={setCampusId} canPick={canPick} />
      {data && (
        <span className="date-filter__static">
          <StatusBadge
            tone={menuPublished ? 'green' : 'gray'}
            label={menuPublished ? 'Thực đơn tuần đã công bố' : 'Chưa có thực đơn tuần đã công bố'}
          />
        </span>
      )}
      {/* Nút thao tác cùng hàng với ô lọc thay vì nằm riêng phía trên */}
      {(ready || (canEdit && weekStart <= thisWeek)) && (
        <div className="kb-toolbar__end">
          {ready && (
            <Link className="btn" to={`/kitchen/market-day?campusId=${campusId}&date=${dayInWeek}`}>
              <ShoppingBasket size={16} /> Đi chợ theo ngày
            </Link>
          )}
          {ready && (
            <Button icon={Download} onClick={() => exportWithPreview(weeklyOrderCsvRows(data), `phieu-dat-hang-tuan-${weekStart}.xlsx`)}>
              Xuất Excel
            </Button>
          )}
          {canEdit && weekStart <= thisWeek && (
            <Button icon={CalendarPlus} onClick={() => go({ week: nextWeek, tab: 'tuan' })}>
              Dự trù tuần sau · {formatDate(nextWeek).slice(0, 5)}–{formatDate(addDays(nextWeek, 4)).slice(0, 5)}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  let body;
  if (md.error && !campusId) body = <ErrorState error={md.error} onRetry={md.reload} />;
  else if (!campusId || (!data && !error) || (loading && !data)) body = <LoadingState />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!ready)
    body = (
      <section className="card">
        <EmptyState
          title={`Chưa có thực đơn tuần ${weekLabel(data.days)}`}
          description="Dự trù tuần tính từ thực đơn tuần đã công bố. Công bố thực đơn tuần trước rồi lập dự trù."
          action={
            <Link className="btn" to={`/menu/weekly?week=${weekStart}`}>
              Mở Thực đơn tuần
            </Link>
          }
        />
      </section>
    );
  else {
    const tabs = (
      <Tabs
        value={tab}
        onChange={(key) => go({ tab: key })}
        items={[
          { key: 'tuan', label: `Dự trù tuần ${weekLabel(data.days).slice(0, 8)}` },
          {
            key: 'ncc',
            label: (
              <>
                Báo NCC thay đổi
                {data.pendingChanges > 0 && <span className="chip chip--orange kb-tab-count">{data.pendingChanges} chưa báo</span>}
              </>
            ),
          },
        ]}
      />
    );
    const weekTab = (
      <>
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">
              <Users size={18} /> Suất dự kiến tuần {weekLabel(data.days).slice(0, 8)}
            </h2>
            {data.savedAt && <span className="text-xs muted">Lưu lúc {formatDateTime(data.savedAt)}</span>}
          </div>
          <WeekForecastGrid data={data} today={today} draft={draft} errors={errors} editable={canEdit} onChange={changeCell} />
          <div className="card__body kb-fc__foot">
            <span className="text-sm muted">
              Gợi ý = đăng ký ăn − nghỉ đã báo; ô là suất bữa trưa, bữa chiều tự trừ trẻ chỉ ăn trưa.
              {canEdit && (
                <>
                  {' '}
                  <span className="kb-fc__mark kb-fc__mark--on" aria-hidden="true" /> đã sửa so với gợi ý.
                </>
              )}
            </span>
            {canEdit && (
              <Button variant="primary" disabled={!dirty} loading={saving} onClick={save}>
                Lưu dự trù
              </Button>
            )}
          </div>
          {Object.keys(errors).length > 0 && (
            <div className="card__body">
              <div className="alert alert--danger">Có ô chưa hợp lệ: {Object.values(errors).join(' ')}</div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card__header">
            <h2 className="card__title">
              <ShoppingBasket size={18} /> Phiếu đặt hàng tuần {weekLabel(data.days).slice(0, 8)}
            </h2>
            <div className="kb-actions">
              {data.sent ? (
                <StatusBadge tone="green" icon={Check} label={`Đã gửi NCC ${formatDateTime(data.sent.at)}`} />
              ) : (
                <StatusBadge tone="gray" label="Chưa gửi NCC" />
              )}
              <Button size="sm" icon={Printer} onClick={() => setPrinting(true)}>
                In
              </Button>
              {canEdit && !data.sent && (
                <Button size="sm" variant="primary" icon={Send} disabled={dirty} onClick={() => setConfirmSend(true)}>
                  Đánh dấu đã gửi NCC
                </Button>
              )}
            </div>
          </div>
          <div className="card__body">
            <Tabs
              value={orderTab}
              onChange={setOrderTab}
              items={[
                { key: 'tuoi', label: 'Hàng tươi · giao theo ngày' },
                {
                  key: 'kho',
                  label: (
                    <>
                      Đồ khô cần mua
                      {data.dry.some((f) => f.toBuy > 0) && (
                        <span className="chip chip--orange kb-tab-count">{data.dry.filter((f) => f.toBuy > 0).length}</span>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </div>
          {orderTab === 'tuoi' ? (
            <>
              <FreshOrderTable data={data} today={today} />
              {data.sent && data.fresh.length > 0 && (
                <p className="card__body text-xs muted">Số gạch là số đã gửi NCC; phần đổi nằm ở tab Báo NCC thay đổi.</p>
              )}
            </>
          ) : (
            <>
              <DryOrderTable data={data} />
              {data.dry.length > 0 && (
                <p className="card__body text-xs muted">
                  Cần cho tuần tính theo dự trù các ngày chưa chốt. Kho chỉ trừ thật lúc chốt suất mỗi ngày.
                </p>
              )}
            </>
          )}
        </section>
      </>
    );
    const nccTab = !data.sent ? (
      <section className="card">
        <EmptyState
          title="Phiếu tuần chưa gửi NCC"
          description="Đánh dấu đã gửi phiếu đặt hàng tuần thì các thay đổi sau đó mới hiện ở đây."
        />
      </section>
    ) : data.changes.length === 0 ? (
      <section className="card">
        <EmptyState title="Không có gì cần báo NCC" description="Số suất các ngày khớp với phiếu đặt hàng tuần đã gửi." />
      </section>
    ) : (
      <div className="kb-ncc-grid">
        {data.changes.map((g) => (
          <SupplierChangeCard
            key={g.date}
            group={g}
            total={totalOf[g.date]}
            today={today}
            canEdit={canEdit}
            override={notifiedOverride}
            onToggle={toggleNotified}
            onToggleAll={toggleAllNotified}
          />
        ))}
      </div>
    );
    body = (
      <div className="kb-stack">
        {tabs}
        {tab === 'tuan' ? weekTab : nccTab}
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.forecast)} />
      {head}
      {toolbar}
      {body}

      <ConfirmationModal
        open={confirmSend}
        title="Đánh dấu đã gửi NCC?"
        message="Sau khi đánh dấu, mọi thay đổi số suất sẽ được so với phiếu này và hiện ở tab Báo NCC thay đổi."
        confirmLabel="Đã gửi NCC"
        onConfirm={send}
        onClose={() => setConfirmSend(false)}
      />

      {ready && (
        <Modal
          open={printing}
          onClose={() => setPrinting(false)}
          size="xl"
          className="print-modal"
          title="Phiếu đặt hàng tuần"
          footer={<PrintToolbar sheetRef={sheetRef} fileBase={`Phieu_dat_hang_tuan_${weekStart}`} printLabel="In phiếu" />}
        >
          <PrintPaperFit>
            <WeeklyOrderPrint ref={sheetRef} data={data} campusName={campus?.shortName || campus?.name} />
          </PrintPaperFit>
        </Modal>
      )}
    </div>
  );
}
