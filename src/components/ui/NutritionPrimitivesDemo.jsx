import { useState } from 'react';
import { Switch } from './Switch';
import { FilterMore } from './FilterMore';
import { RowMenu } from './RowMenu';
import { EditHead } from './EditHead';
import { SidePanel } from './SidePanel';

export function NutritionPrimitivesDemo() {
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <div className="stack">
      <EditHead backTo="/ui-kit" title="Mẫu đầu trang sửa" meta="Dữ liệu minh họa" />
      <div className="row row--wrap">
        <Switch checked={checked} onChange={setChecked} label="Bật tùy chọn minh họa" />
        <span>{checked ? 'Đang bật' : 'Đang tắt'}</span>
        <FilterMore>
          <p>Bộ lọc phụ đặt trong khung này.</p>
        </FilterMore>
        <RowMenu label="Thao tác dòng minh họa" items={[{ label: 'Xem thư viện', to: '/ui-kit' }]} />
        <button className="btn" onClick={() => setOpen(true)}>
          Xem panel rộng
        </button>
      </div>
      <SidePanel open={open} onClose={() => setOpen(false)} title="Panel rộng minh họa" wide>
        <p>Dùng cho bảng xem nhanh nhiều cột; panel mặc định ở màn cũ giữ nguyên.</p>
      </SidePanel>
    </div>
  );
}
