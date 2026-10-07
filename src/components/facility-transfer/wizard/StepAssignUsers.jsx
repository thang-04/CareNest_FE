import { Bell } from 'lucide-react';
import { UserPicker } from '@/components/facility-transfer/UserPicker';

/** Bước 3 – Chọn người thực hiện (LuanChuyen3 mockup). Handover + receiver are both required. */
export function StepAssignUsers({ wizard, md }) {
  const { form, errors } = wizard;
  const from = md.locationById(form.fromLocationId);
  const to = md.locationById(form.toLocationId);

  return (
    <section className="card wizard-card">
      <h2 className="section-title">3.&nbsp; Chọn người thực hiện</h2>
      <div className="assign-grid">
        <UserPicker
          title="Người bàn giao (tại nơi đi)"
          tone="from"
          location={from}
          campus={md.campusById(form.fromCampusId)}
          users={md.users}
          locations={md.locations}
          campuses={md.campuses}
          value={form.handoverUserId}
          error={errors.handoverUserId}
        />
        <UserPicker
          title="Người nhận (tại nơi đến)"
          tone="to"
          location={to}
          campus={md.campusById(form.toCampusId)}
          users={md.users}
          locations={md.locations}
          campuses={md.campuses}
          value={form.receiverUserId}
          error={errors.receiverUserId}
        />
      </div>

      <h3 className="subsection-title mt-24 text-lg">Danh sách tài sản đã chọn</h3>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th className="center">STT</th>
              <th className="center">Mã tài sản</th>
              <th>Tên tài sản</th>
              <th className="center">Đơn vị</th>
              <th className="center">Số lượng luân chuyển</th>
            </tr>
          </thead>
          <tbody>
            {form.items.map((i, idx) => (
              <tr key={i.assetId}>
                <td className="center">{idx + 1}</td>
                <td className="center">{i.assetCode}</td>
                <td>{i.assetName}</td>
                <td className="center">{i.unit}</td>
                <td className="center">{i.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card mt-16" style={{ padding: 16 }}>
        <h3 className="subsection-title text-lg">Thông báo đến người thực hiện</h3>
        <div className="alert alert--info text-sm">
          <Bell size={17} />
          <div>
            Khi gửi phiếu, hệ thống tự gửi thông báo cho người bàn giao và người nhận. Người được phân công xem chi tiết phiếu và xác nhận
            theo đúng quy trình.
          </div>
        </div>
      </div>
    </section>
  );
}
