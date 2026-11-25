import { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { useSearchParams } from 'react-router-dom';
import {
  Breadcrumb,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PrintPaperFit,
  PrintSignerFields,
  PrintToolbar,
  SelectField,
  TextField,
} from '@/components';
import { Download, Printer } from '@/components/ui/icons';
import { exportWithPreview } from '@/components/ui/ExportPreview';
import { MENU_STAT_SIGNERS, MenuStatisticsPrint } from '@/components/menu-planning/MenuStatisticsPrint';
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
import { ageGroupOptions, allDayItems, planDayItems, statisticsExportRows, templateDayItems } from '@/utils/menu-planning/menuStatistics';
import { formatDate, isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

// Tên màn theo việc người dùng làm (user chốt 09/11/2026, thay "Thống kê định lượng")
const PAGE_TITLE = 'Định lượng & đi chợ';
const GROUP_MODES = [
  { key: 'storage', label: 'Tươi / Khô' },
  { key: 'supplier', label: 'Theo nhà cung cấp' },
];

const OVERVIEW = 'overview';

// Tổng quan các nhóm tuổi: nhóm 0 trẻ chỉ một dòng ghi chú, không dựng bảng chi tiết toàn số 0
function GroupsOverview({ groups, onPick }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Tổng quan theo nhóm tuổi</h2>
      </div>
      <DataTable
        rowKey="ageGroupId"
        rows={groups}
        columns={[
          {
            key: 'name',
            header: 'Nhóm tuổi',
            render: (g) => (
              <>
                <Button variant="link" onClick={() => onPick(String(g.ageGroupId))}>
                  {g.ageGroupName}
                </Button>
                {g.children === 0 && <span className="muted"> · Không có trẻ, không tính suất ăn</span>}
              </>
            ),
          },
          { key: 'children', header: 'Số trẻ', className: 'num', render: (g) => g.children },
          {
            key: 'costPerChild',
            header: 'Tiền ăn 1 trẻ',
            className: 'num',
            render: (g) => (g.children === 0 ? '—' : formatMoney(g.costPerChild)),
          },
          {
            key: 'budget',
            header: 'Ngân sách thực phẩm',
            className: 'num',
            render: (g) => {
              const budget = g.foodBudget ?? g.mealPrice;
              if (g.children === 0) return '—';
              return budget == null ? 'Chưa đặt' : formatMoney(budget);
            },
          },
          {
            key: 'totalCost',
            header: 'Tổng tiền',
            className: 'num',
            render: (g) => (g.children === 0 ? '—' : formatMoney(g.totalCost)),
          },
        ]}
      />
    </section>
  );
}

const CHILDREN_SOURCE = {
  INPUT: 'Số nhập tay',
  CONFIRMED: 'Theo suất đã xác nhận',
  ENROLLED: 'Theo sĩ số đang học',
  MIXED: 'Nhiều nguồn theo từng nhóm',
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
  const [signers, setSigners] = useState(MENU_STAT_SIGNERS);
  const [groupBy, setGroupBy] = useState('storage');
  // Chế độ "Tất cả nhóm tuổi": 'overview' hoặc id nhóm tuổi đang xem chi tiết
  const [view, setView] = useState(OVERVIEW);
  const sheetRef = useRef(null);
  useEffect(() => {
    if (ageGroupId && options.length && !options.some((o) => o.id === ageGroupId)) setAgeGroupId('');
  }, [options, ageGroupId]);

  const allGroups = ageGroupId === '';
  const items = useMemo(() => {
    if (templateId) {
      const templateItems = templateDayItems(source.data);
      return allGroups ? templateItems.map((item) => ({ ...item, block: source.data?.block })) : templateItems;
    }
    return allGroups ? allDayItems(source.data, date) : planDayItems(source.data, date, ageGroupId);
  }, [templateId, source.data, date, ageGroupId, allGroups]);
  const query =
    options.length && items.length
      ? {
          ageGroupId: allGroups ? null : Number(ageGroupId),
          date: templateId ? undefined : date,
          campusId: campusId || undefined,
          children: allGroups ? '' : children,
          items,
        }
      : null;
  const statsQ = useMenuStatistics(query);
  const stats = statsQ.data;
  const activeGroup = (stats?.groups || []).find((g) => String(g.ageGroupId) === view) || null;

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
    exportWithPreview(statisticsExportRows(stats, `${PAGE_TITLE} · ${title} · ${stats.ageGroupName}`, groupBy), `${fileBase}.xlsx`);

  const detailSections = (group) => (
    <div className="td-sections" key={group.ageGroupId}>
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Món ăn{allGroups ? ` · ${group.ageGroupName}` : ''}</h2>
        </div>
        <StatisticsDishes
          dishes={group.dishes}
          catalog={catalog}
          ageGroup={ageGroups.find((g) => String(g.id) === String(group.ageGroupId))}
        />
      </section>
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">
            Thực phẩm cho {group.children} trẻ{allGroups ? ` · ${group.ageGroupName}` : ''}
          </h2>
          <Tabs
            variant="pill"
            items={GROUP_MODES}
            value={groupBy}
            onChange={setGroupBy}
            ariaLabel={`Cách nhóm thực phẩm ${group.ageGroupName}`}
          />
        </div>
        <StatisticsIngredients stats={group} groupBy={groupBy} />
      </section>
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Dinh dưỡng một trẻ · {group.ageGroupName}</h2>
        </div>
        <StatisticsNutrition stats={group} />
      </section>
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Đánh giá tỉ lệ calo từng bữa{allGroups ? ` · ${group.ageGroupName}` : ''}</h2>
        </div>
        <StatisticsSessions sessions={group.evaluation?.sessions} noQuantity={!group.ingredients?.length} />
      </section>
    </div>
  );

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
      <h1 className="page__title">{PAGE_TITLE}</h1>

      <section className="card">
        <div className="card__body td-stat-filters">
          <div className="td-stat-filters__top">
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
            {stats && (
              <div className="page__actions td-stat-filters__actions">
                <Button onClick={exportExcel}>
                  <Download size={16} /> Xuất Excel
                </Button>
                <Button onClick={() => setPrinting(true)}>
                  <Printer size={16} /> Xem trước bản in
                </Button>
              </div>
            )}
          </div>
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
              <SelectField className="select" value={ageGroupId} onChange={(e) => setAgeGroupId(e.target.value)}>
                <option value="">Tất cả nhóm tuổi</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </SelectField>
            </FormField>
            {!templateId && <CampusFilter campuses={campuses} value={campusId} onChange={setCampusId} allLabel="Cả trường" />}
            {!allGroups && (
              <FormField
                label="Số trẻ"
                hint={stats ? CHILDREN_SOURCE[stats.childrenSource] || stats.childrenSource : 'Để trống để lấy theo suất hoặc sĩ số'}
              >
                <TextField
                  className="input"
                  type="number"
                  min={0}
                  max={2000}
                  value={children}
                  placeholder={stats ? String(stats.children) : 'Tự lấy'}
                  onChange={(e) => setChildren(e.target.value)}
                />
              </FormField>
            )}
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
      ) : allGroups && !stats.groups?.length ? (
        <EmptyState title="Ngày này chưa có món" description="Không có món hợp lệ cho các nhóm tuổi trong ngày này." />
      ) : (
        <>
          <div className="stat-grid">
            <StatCard
              className="stat-card--fit"
              tone="blue"
              icon={false}
              label={
                stats.childrenSource
                  ? `Số trẻ · ${(CHILDREN_SOURCE[stats.childrenSource] || stats.childrenSource).toLowerCase()}`
                  : 'Số trẻ'
              }
              value={stats.children}
            />
            <StatCard className="stat-card--fit" tone="green" icon={false} label="Tiền ăn 1 trẻ" value={formatMoney(stats.costPerChild)} />
            {/* Ngân sách mỗi nhóm tuổi một mức: xem theo từng nhóm, không có số toàn trường */}
            {!allGroups && (
              <StatCard
                className="stat-card--fit"
                tone="purple"
                icon={false}
                label="Ngân sách thực phẩm"
                value={(stats.foodBudget ?? stats.mealPrice) == null ? 'Chưa đặt' : formatMoney(stats.foodBudget ?? stats.mealPrice)}
              />
            )}
            <StatCard
              className="stat-card--fit"
              tone="orange"
              icon={false}
              label={`Tổng tiền ${stats.children} trẻ`}
              value={formatMoney(stats.totalCost)}
            />
          </div>

          {allGroups ? (
            <>
              <Tabs
                variant="pill"
                ariaLabel="Xem theo nhóm tuổi"
                value={activeGroup ? String(activeGroup.ageGroupId) : OVERVIEW}
                onChange={setView}
                items={[
                  { key: OVERVIEW, label: 'Tổng quan' },
                  ...(stats.groups || []).map((g) => ({
                    key: String(g.ageGroupId),
                    label: g.ageGroupName,
                    count: g.children,
                  })),
                ]}
              />
              {!activeGroup ? (
                <GroupsOverview groups={stats.groups || []} onPick={setView} />
              ) : activeGroup.children === 0 ? (
                <EmptyState
                  title={`${activeGroup.ageGroupName}: không có trẻ`}
                  description="Nhóm này không có trẻ trong ngày đã chọn nên chưa có suất ăn và định lượng để hiển thị."
                />
              ) : (
                detailSections(activeGroup)
              )}
            </>
          ) : (
            detailSections(stats)
          )}
          <Modal
            open={printing}
            onClose={() => setPrinting(false)}
            size="xl"
            className="print-modal"
            title={PAGE_TITLE}
            footer={<PrintToolbar sheetRef={sheetRef} fileBase={fileBase} onClose={() => setPrinting(false)} onCsv={exportExcel} />}
          >
            <PrintSignerFields signers={signers} onChange={setSigners} />
            <PrintPaperFit>
              <MenuStatisticsPrint ref={sheetRef} stats={stats} title={title} signers={signers} groupBy={groupBy} />
            </PrintPaperFit>
          </Modal>
        </>
      )}
    </div>
  );
}
