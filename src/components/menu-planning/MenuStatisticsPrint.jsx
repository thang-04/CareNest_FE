import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { PrintSignRow } from '@/components/print/PrintSignRow';
import { MEAL_SESSION_LABELS, SESSION_ORDER, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { storageGroups } from '@/utils/menu-planning/menuStatistics';

const num = (v, digits = 2) => (v == null || v === '' ? '' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: digits }));
/** Người ký mặc định của phiếu; người duyệt (cột phải) là người ký chính. Họ tên gõ ở dải trên bản xem trước. */
export const MENU_STAT_SIGNERS = [{ title: 'Người lập' }, { title: 'Người duyệt' }];

const FoodTable = ({ rows }) => (
  <table className="ps-table">
    <thead>
      <tr>
        <th>STT</th>
        <th>Thực phẩm</th>
        <th>Lượng mua</th>
        <th>ĐVT</th>
        <th>Đơn giá</th>
        <th>Thành tiền</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={r.foodId}>
          <td className="c">{i + 1}</td>
          <td>{r.foodName}</td>
          <td className="c">{num(r.purchaseQty, 3)}</td>
          <td className="c">{r.purchaseUnit}</td>
          <td className="c">{r.unitPrice == null ? '' : formatMoney(r.unitPrice)}</td>
          <td className="c">{formatMoney(r.cost)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/**
 * Phiếu định lượng & đi chợ A4 (mẫu `.print-sheet`) của một ngày thực đơn: món theo bữa, bảng thực phẩm (chia "Cần mua
 * (hàng tươi)" / "Lấy từ kho khô" khi BE trả cờ), tổng tiền; họ tên người ký nhận từ dải ô phía trên bản xem trước (không lưu).
 * Số liệu lấy nguyên từ `POST /nutrition/menu-statistics`.
 */
export const MenuStatisticsPrint = forwardRef(function MenuStatisticsPrint({ stats, title, signers = MENU_STAT_SIGNERS }, ref) {
  const groups = storageGroups(stats);
  const sessions = SESSION_ORDER.map((s) => ({ s, dishes: stats.dishes.filter((d) => d.session === s) })).filter((x) => x.dishes.length);
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>PHIẾU ĐỊNH LƯỢNG & ĐI CHỢ</h1>
        <div>
          {title} · {stats.ageGroupName} · {stats.children} trẻ
        </div>
      </div>
      <h2 className="ps-section">Thực đơn</h2>
      <table className="ps-table">
        <tbody>
          {sessions.map(({ s, dishes }) => (
            <tr key={s}>
              <td>{MEAL_SESSION_LABELS[s] || s}</td>
              <td>{dishes.map((d) => d.dishName).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {groups ? (
        groups.map((g) => (
          <div key={g.key}>
            <h2 className="ps-section">
              {g.title} · {formatMoney(g.total)}
            </h2>
            <FoodTable rows={g.rows} />
          </div>
        ))
      ) : (
        <>
          <h2 className="ps-section">Thực phẩm</h2>
          <FoodTable rows={stats.ingredients} />
        </>
      )}
      <p>
        <b>
          Tổng tiền ăn {stats.children} trẻ: {formatMoney(stats.totalCost)}
        </b>{' '}
        · Tiền ăn 1 trẻ: {formatMoney(stats.costPerChild)}
      </p>
      <PrintSignRow signers={signers} />
    </div>
  );
});
