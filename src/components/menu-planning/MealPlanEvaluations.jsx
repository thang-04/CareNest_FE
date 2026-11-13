import { Fragment, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import {
  EVAL_ROW_LABELS,
  EVAL_ROW_UNITS,
  MEAL_SESSION_LABELS,
  MICRONUTRIENTS,
  formatMoney,
} from '@/models/menu-planning/menuPlanningConstants';
import { formatQty } from '@/utils/format';
import { evaluationGroups, evaluationSessions } from '@/utils/menu-planning/mealPlanGrid';
import { dayLabel } from '@/utils/menu-planning/menuChecks';

// Chữ ngắn dưới con số: nói rõ trạng thái bằng chữ, không chỉ bằng màu
const ROW_NOTE = { LOW: 'Thấp', HIGH: 'Cao', OK: 'Đạt' };
// Nền ô theo trạng thái BE trả: thấp đỏ nhạt, cao cam nhạt; không tự so định mức ở client
const ROW_TONE = { OK: 'ok', LOW: 'low', HIGH: 'high', NA: 'muted', INCOMPLETE: 'muted' };
// Cơ cấu P:L:G: định mức là % năng lượng (BE NUT-24) ⇒ hiện % năng lượng BE trả (`percent`)
const ENERGY_SHARE_KEYS = ['protein', 'lipid', 'glucid'];
const SECTIONS = [
  { title: 'Năng lượng và cơ cấu P : L : G', keys: ['kcal', 'protein', 'lipid', 'glucid'] },
  { title: 'Định lượng theo chất', keys: ['animalProteinG', 'plantProteinG', 'animalLipidG', 'plantLipidG', 'glucidG'] },
];

const unitOf = (key) => (ENERGY_SHARE_KEYS.includes(key) ? '%' : EVAL_ROW_UNITS[key]);
const statusNote = (row) => {
  if (row.status === 'NA') return 'Chưa đặt định mức';
  if (row.status === 'INCOMPLETE') return 'Chưa đủ dữ liệu';
  return [ROW_NOTE[row.status], row.attainment != null ? `${formatQty(row.attainment)}% đạt` : null].filter(Boolean).join(' · ');
};
const range = (row, unit) =>
  row && (row.min != null || row.max != null)
    ? `${row.min != null ? formatQty(row.min) : '…'} – ${row.max != null ? formatQty(row.max) : '…'} ${unit}`
    : '—';
// Định mức của một chỉ số giống nhau giữa các ngày (cùng phiên bản cấu hình) ⇒ lấy dòng đầu có khoảng
const normOf = (group, dates, key) =>
  dates.map((d) => group.byDate[d]?.rows?.find((r) => r.key === key)).find((r) => r && (r.min != null || r.max != null));

function RowCell({ row }) {
  if (!row) return <td className="td-eval__cell">—</td>;
  const share = ENERGY_SHARE_KEYS.includes(row.key);
  const main = share ? row.percent : row.value;
  return (
    <td className={`td-eval__cell td-eval__cell--${ROW_TONE[row.status] || 'muted'}`}>
      <span className="fw-600">{main == null ? '—' : `${formatQty(main)} ${share ? '%' : EVAL_ROW_UNITS[row.key]}`}</span>
      <small>{statusNote(row)}</small>
    </td>
  );
}

// Một bữa: % nhu cầu năng lượng cả ngày so khoảng định mức của bữa (BE NUT-25)
function SessionCell({ row }) {
  if (!row) return <td className="td-eval__cell">—</td>;
  return (
    <td className={`td-eval__cell td-eval__cell--${ROW_TONE[row.status] || 'muted'}`}>
      <span className="fw-600">{row.percent != null ? `${formatQty(row.percent)}%` : '—'}</span>
      <small>
        {formatQty(row.kcal)} kcal · {statusNote(row)}
      </small>
    </td>
  );
}

/**
 * Bảng kiểm dinh dưỡng của khối do BE tính sau khi lưu: mỗi nhóm tuổi một tab; hàng chia nhóm (năng lượng và P:L:G,
 * gam theo chất, năng lượng từng bữa, vi chất, tiền ăn), cột Định mức rồi các ngày; ô tô nền theo trạng thái BE trả.
 */
export function MealPlanEvaluations({ plan, block }) {
  const groups = evaluationGroups(plan, block);
  const [tab, setTab] = useState('');
  const [showMicro, setShowMicro] = useState(false);
  if (!groups.length)
    return <p className="td-card-note td-flat muted">Chưa có bảng kiểm. Lưu nháp để hệ thống kiểm tra theo định mức của từng nhóm tuổi.</p>;
  const group = groups.find((g) => g.ageGroupId === tab) || groups[0];
  const dates = plan.days.map((d) => d.date);
  const cols = dates.length + 2;
  const sectionRows = (keys) =>
    keys.map((key) => (
      <tr key={key}>
        <th scope="row">{EVAL_ROW_LABELS[key]}</th>
        <td className="td-eval__norm">{range(normOf(group, dates, key), unitOf(key))}</td>
        {dates.map((date) => (
          <RowCell key={date} row={group.byDate[date]?.rows?.find((r) => r.key === key)} />
        ))}
      </tr>
    ));
  const head = (title, extra) => (
    <tr className="td-eval__group">
      <th scope="colgroup" colSpan={cols}>
        <span>{title}</span>
        {extra}
      </th>
    </tr>
  );

  return (
    <div className="td-eval-wrap">
      <div className="td-eval__bar">
        <Tabs
          variant="pill"
          items={groups.map((g) => ({ key: g.ageGroupId, label: g.ageGroupName }))}
          value={group?.ageGroupId}
          onChange={setTab}
          ariaLabel="Nhóm tuổi"
        />
        <span className="td-eval__legend text-sm">
          <i className="td-eval__dot td-eval__dot--low" /> Thấp so với định mức
          <i className="td-eval__dot td-eval__dot--high" /> Cao so với định mức
        </span>
      </div>
      <div className="table-wrap">
        <table className="table table--grid td-eval">
          <thead>
            <tr>
              <th>Chỉ số</th>
              <th>Định mức / ngày</th>
              {dates.map((date) => (
                <th key={date}>{dayLabel(date)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="td-eval__result">
              <th scope="row">Kết quả ngày</th>
              <td />
              {dates.map((date) => (
                <td key={date} className="td-eval__cell">
                  {group.byDate[date] ? <NormStatusChip status={group.byDate[date].status} /> : '—'}
                </td>
              ))}
            </tr>
            {SECTIONS.map((sec) => (
              <Fragment key={sec.title}>
                {head(sec.title)}
                {sectionRows(sec.keys)}
              </Fragment>
            ))}
            {evaluationSessions(group).length > 0 && head('Năng lượng từng bữa (% nhu cầu cả ngày)')}
            {evaluationSessions(group).map((session) => {
              const norm = dates.map((d) => group.byDate[d]?.sessions?.find((r) => r.session === session)).find(Boolean);
              return (
                <tr key={session}>
                  <th scope="row">{MEAL_SESSION_LABELS[session] || session}</th>
                  <td className="td-eval__norm">{range(norm, '%')}</td>
                  {dates.map((date) => (
                    <SessionCell key={date} row={group.byDate[date]?.sessions?.find((r) => r.session === session)} />
                  ))}
                </tr>
              );
            })}
            {head(
              'Vi chất',
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowMicro((v) => !v)}>
                {showMicro ? 'Thu gọn' : `Hiện ${MICRONUTRIENTS.length} vi chất`}
              </button>,
            )}
            {showMicro && sectionRows(MICRONUTRIENTS)}
            {head('Tiền ăn')}
            <tr>
              <th scope="row">Tiền ăn / trẻ</th>
              <td className="td-eval__norm">{formatMoney(dates.map((d) => group.byDate[d]?.mealPrice).find((v) => v != null))}</td>
              {dates.map((date) => {
                const ev = group.byDate[date];
                // Vượt giá suất: dùng trạng thái giá BE gửi qua issues; ở đây chỉ so hai số BE trả để tô nền
                const over = ev && ev.mealPrice != null && Number(ev.cost) > Number(ev.mealPrice);
                return (
                  <td key={date} className={`td-eval__cell ${over ? 'td-eval__cell--high' : ''}`}>
                    {ev ? <span className="fw-600">{formatMoney(ev.cost)}</span> : '—'}
                    {over && <small>Vượt giá suất</small>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
