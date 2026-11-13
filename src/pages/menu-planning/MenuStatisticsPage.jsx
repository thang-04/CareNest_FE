import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { useSearchParams } from 'react-router-dom';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, Modal, PrintPaperFit, PrintToolbar } from '@/components';
import { Download, Printer } from '@/components/ui/icons';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { MenuStatisticsPrint } from '@/components/menu-planning/MenuStatisticsPrint';
import { FormField } from '@/components/form/FormField';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { StatCard } from '@/components/ui/StatCard';
import {
  StatisticsDishes,
  StatisticsIngredients,
  StatisticsNutrition,
  StatisticsSessions,
} from '@/components/menu-planning/MenuStatistics';
import { useMasterData } from '@/hooks';
import { useBeAgeGroups, useMealPlan, useMenuStatistics } from '@/hooks/menu-planning/useMealPlan';
import { useDishes } from '@/hooks/menu-planning/useMenuPlanning';
import { useMenuTemplate } from '@/hooks/menu-planning/useMenuTemplates';
import { WeekPicker } from '@/components/form/WeekPicker';
import { WEEKDAY_LABELS, formatMoney, mondayOf, schoolWeekStart, weekDates } from '@/models/menu-planning/menuPlanningConstants';
import { menuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { ageGroupOptions, planDayItems, statisticsExportRows, templateDayItems } from '@/utils/menu-planning/menuStatistics';
import { formatDate, isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

// Tên màn theo việc người dùng làm (user chốt 09/11/2026, thay "Thống kê định lượng")
const PAGE_TITLE = 'Định lượng & đi chợ';

const CHILDREN_SOURCE = {
  INPUT: 'Số nhập tay',
  CONFIRMED: 'Theo suất đã xác nhận',
  ENROLLED: 'Theo sĩ số đang học',
};

/*
 * Định lượng & đi chợ của một ngày thực đơn (in, xuất Excel; tách hàng tươi / kho khô khi BE trả cờ): nguồn là kế hoạch tuần (`?week=&date=`) hoặc bộ mẫu
 * (`?template=`, mẫu một ngày). Số trẻ để trống ⇒ BE lấy suất đã xác nhận, không có thì sĩ số.
 */
export default function MenuStatisticsPage() {
  const [params, setParams] = useSearchParams();
  const templateId = params.get('template');
  // Mở từ menu (không ngữ cảnh) ⇒ tuần đang chạy, hôm nay nếu nằm trong tuần đó, không thì thứ Hai
  const today = todayInput();
  const week = templateId ? null : isIsoDate(params.get('week')) ? mondayOf(params.get('week')) : schoolWeekStart(today);
  const date = templateId ? '' : params.get('date') || (weekDates(week).includes(today) ? today : week);

  const planQ = useMealPlan(templateId ? null : week);
  const templateQ = useMenuTemplate(templateId || null);
  const source = templateId ? templateQ : planQ;
  const { ageGroups } = useBeAgeGroups();
  const { items: catalog } = useDishes({});
  const { campuses } = useMasterData();

  const options = useMemo(() => {
    const ids = templateId ? source.data?.ageGroupIds : (source.data?.blocks || []).flatMap((b) => b.ageGroupIds || []);
    return ageGroupOptions(ids, ageGroups);
  }, [templateId, source.data, ageGroups]);

  const [ageGroupId, setAgeGroupId] = useState('');
  const [campusId, setCampusId] = useState('');
  const [children, setChildren] = useState('');
  const [printing, setPrinting] = useState(false);
  const sheetRef = useRef(null);
  useEffect(() => {
    if (options.length && !options.some((o) => o.id === ageGroupId)) setAgeGroupId(options[0].id);
  }, [options, ageGroupId]);

  const items = useMemo(
    () => (templateId ? templateDayItems(source.data) : planDayItems(source.data, date, ageGroupId)),
    [templateId, source.data, date, ageGroupId],
  );
  const query =
    ageGroupId && items.length
      ? { ageGroupId: Number(ageGroupId), date: templateId ? undefined : date, campusId: campusId || undefined, children, items }
      : null;
  const statsQ = useMenuStatistics(query);
  const stats = statsQ.data;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  // Ngữ cảnh (mẫu nào / ngày nào) nằm ở mục cuối breadcrumb thay cho dòng mô tả
  const title = templateId ? `Mẫu · ${source.data?.name || ''}` : `Thực đơn ngày ${formatDate(date)}`;
  const crumbs = templateId
    ? menuCrumbs('Mẫu thực đơn', `/menu/templates/${templateId}`, `${PAGE_TITLE} · ${title}`)
    : menuCrumbs('Thực đơn tuần', '/menu/weekly', `${PAGE_TITLE} · ${title}`);
  const fileBase = `Dinh_luong_di_cho_${templateId ? `mau_${templateId}` : date}`;
  const exportExcel = () =>
    exportWithPreview(statisticsExportRows(stats, `${PAGE_TITLE} · ${title} · ${stats.ageGroupName}`), `${fileBase}.xlsx`);

  if (source.error)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ErrorState error={source.error} onRetry={source.reload} />
      </div>
    );
  if (source.loading || !source.data)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );

  return (
    <div className="page td-sections">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <div>
          <h1 className="page__title">{PAGE_TITLE}</h1>
        </div>
        {stats && (
          <div className="page__actions">
            <button type="button" className="btn" onClick={exportExcel}>
              <Download size={16} /> Xuất Excel
            </button>
            <button type="button" className="btn" onClick={() => setPrinting(true)}>
              <Printer size={16} /> Xem trước bản in
            </button>
          </div>
        )}
      </div>

      <section className="card">
        <div className="card__body td-stat-filters">
          {templateId ? null : (
            <WeekPicker
              value={week}
              thisWeek={schoolWeekStart(today)}
              onChange={(next) => {
                const p = new URLSearchParams(params);
                p.set('week', next);
                p.delete('date');
                setParams(p, { replace: true });
              }}
            />
          )}
          {templateId ? null : (
            <Tabs
              variant="pill"
              items={weekDates(week).map((d, i) => ({
                key: d,
                label: (
                  <>
                    {WEEKDAY_LABELS[i]} <span className="muted">{formatDate(d).slice(0, 5)}</span>
                  </>
                ),
              }))}
              value={date}
              onChange={(d) => setParam('date', d)}
              ariaLabel="Ngày trong tuần"
            />
          )}
          <div className="td-stat-filters__row">
            <FormField label="Nhóm tuổi">
              <select className="select" value={ageGroupId} onChange={(e) => setAgeGroupId(e.target.value)}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </FormField>
            {!templateId && <CampusFilter campuses={campuses} value={campusId} onChange={setCampusId} allLabel="Cả trường" />}
            <FormField
              label="Số trẻ"
              hint={stats ? CHILDREN_SOURCE[stats.childrenSource] || stats.childrenSource : 'Để trống để lấy theo suất hoặc sĩ số'}
            >
              <input
                className="input"
                type="number"
                min={0}
                max={2000}
                value={children}
                placeholder={stats ? String(stats.children) : 'Tự lấy'}
                onChange={(e) => setChildren(e.target.value)}
              />
            </FormField>
          </div>
        </div>
      </section>

      {!items.length ? (
        <EmptyState
          title="Ngày này chưa có món"
          description={templateId ? 'Chọn món cho ngày này trong bộ mẫu rồi xem lại.' : 'Ngày nghỉ hoặc khối của nhóm tuổi chưa có món.'}
        />
      ) : statsQ.error ? (
        <ErrorState error={statsQ.error} onRetry={statsQ.reload} />
      ) : !stats ? (
        <LoadingState />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard className="stat-card--fit" tone="blue" icon={false} label="Số trẻ" value={stats.children} />
            <StatCard className="stat-card--fit" tone="green" icon={false} label="Tiền ăn 1 trẻ" value={formatMoney(stats.costPerChild)} />
            <StatCard
              className="stat-card--fit"
              tone="purple"
              icon={false}
              label="Định mức tiền ăn"
              value={stats.mealPrice == null ? 'Chưa đặt' : formatMoney(stats.mealPrice)}
            />
            <StatCard
              className="stat-card--fit"
              tone="orange"
              icon={false}
              label={`Tổng tiền ${stats.children} trẻ`}
              value={formatMoney(stats.totalCost)}
            />
          </div>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Món ăn</h2>
            </div>
            <StatisticsDishes
              dishes={stats.dishes}
              catalog={catalog}
              ageGroup={ageGroups.find((g) => String(g.id) === String(ageGroupId))}
            />
          </section>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thực phẩm cho {stats.children} trẻ</h2>
            </div>
            <StatisticsIngredients stats={stats} />
          </section>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Dinh dưỡng một trẻ · {stats.ageGroupName}</h2>
            </div>
            <StatisticsNutrition stats={stats} />
          </section>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Đánh giá tỉ lệ calo từng bữa</h2>
            </div>
            <StatisticsSessions sessions={stats.evaluation?.sessions} />
          </section>
          <Modal
            open={printing}
            onClose={() => setPrinting(false)}
            size="xl"
            className="print-modal"
            title={PAGE_TITLE}
            footer={<PrintToolbar sheetRef={sheetRef} fileBase={fileBase} onCsv={exportExcel} printLabel="In phiếu" />}
          >
            <PrintPaperFit>
              <MenuStatisticsPrint ref={sheetRef} stats={stats} title={title} />
            </PrintPaperFit>
          </Modal>
        </>
      )}
    </div>
  );
}
