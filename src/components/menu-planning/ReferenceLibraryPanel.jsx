import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, CopyPlus, Search } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useReferenceDishes } from '@/hooks/menu-planning/useMenuPlanning';
import { copyReferenceDish } from '@/services/menu-planning/menuPlanningService';
import { SidePanel } from '@/components/ui/SidePanel';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips } from '@/components/menu-planning/MenuBadges';
import { ageAbbr } from '@/utils/menu-planning/nutritionSetup';
import { DISH_TYPE_LABELS } from '@/models/menu-planning/menuPlanningConstants';

/**
 * Thư viện món tham khảo (chỉ đọc): PHT xem công thức theo nhóm tuổi và chép món về danh mục của trường.
 * Thực phẩm trường chưa có được báo trước và thêm khi chép (chưa có đơn giá).
 */
export function ReferenceLibraryPanel({ open, onClose, groups, canCopy }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [picked, setPicked] = useState(null);
  const [openIds, setOpenIds] = useState([]);
  const toggle = (id) => setOpenIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const { items, loading, error, reload } = useReferenceDishes({ keyword, type });
  const missing = picked ? picked.ingredients.filter((i) => !i.inCatalog).map((i) => i.foodName) : [];

  const copy = async () => {
    try {
      const { dish, addedFoods } = await copyReferenceDish(picked.id, user);
      toast.success(
        addedFoods.length
          ? `Đã thêm món và ${addedFoods.length} thực phẩm mới (cần bổ sung đơn giá).`
          : 'Đã thêm món vào danh mục của trường.',
      );
      setPicked(null);
      onClose();
      navigate(`/menu/dishes/${dish.id}/edit`);
    } catch (err) {
      toast.error(err, 'Không chép được món');
      setPicked(null);
    }
  };

  return (
    <SidePanel open={open} title="Thư viện món tham khảo" onClose={onClose} wide>
      <p className="text-sm muted td-lib-note">
        Dữ liệu minh họa — danh mục chung chỉ đọc. Món chép về là bản riêng của trường, sửa không ảnh hưởng thư viện.
      </p>
      <div className="filter-bar td-lib-filter">
        <label className="search-box td-grow">
          <Search size={17} className="muted" />
          <input
            placeholder="Tìm món tham khảo..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="Tìm món tham khảo"
          />
        </label>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại món">
          <option value="">Tất cả loại món</option>
          {Object.entries(DISH_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState title="Không có món phù hợp" description="Thử đổi từ khóa hoặc loại món." />
      ) : (
        <ul className="td-lib-list">
          {items.map((d) => (
            <li key={d.id} className={`td-lib-item ${openIds.includes(d.id) ? 'td-lib-item--open' : ''}`}>
              <div className="td-lib-item__head">
                {/* Mặc định thu gọn: bấm tên món để xem thành phần theo nhóm tuổi */}
                <button type="button" className="td-acc__toggle" aria-expanded={openIds.includes(d.id)} onClick={() => toggle(d.id)}>
                  <ChevronDown size={18} className="td-acc__chev" aria-hidden="true" />
                  <span>
                    <b>{d.name}</b> <span className="text-sm muted">· {DISH_TYPE_LABELS[d.type]}</span>
                  </span>
                  <span className="td-acc__summary">
                    {d.ingredients.length} thành phần · {groups.map((g) => `${ageAbbr(g.id)} ${d.kcal[g.id]} kcal`).join(' · ')}
                  </span>
                  <AllergenChips allergens={d.allergens} empty="" />
                </button>
                {d.inCatalog ? (
                  <span className="chip chip--gray">Đã có trong danh mục</span>
                ) : (
                  canCopy && (
                    <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setPicked(d)}>
                      <CopyPlus size={15} /> Thêm vào món của trường
                    </button>
                  )
                )}
              </div>
              {openIds.includes(d.id) && (
                <div className="table-wrap">
                  <table className="table table--grid table--compact">
                    <thead>
                      <tr>
                        <th>Thành phần</th>
                        {groups.map((g) => (
                          <th key={g.id} className="num">
                            {ageAbbr(g.id)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.ingredients.map((i) => (
                        <tr key={i.foodName}>
                          <td>
                            {i.foodName}
                            {!i.inCatalog && <span className="chip chip--orange td-lib-new">Trường chưa có</span>}
                          </td>
                          {groups.map((g) => (
                            <td key={g.id} className="num nowrap">
                              {i.portions[g.id]} {i.unit}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Năng lượng 1 suất</td>
                        {groups.map((g) => (
                          <td key={g.id} className="num nowrap">
                            {d.kcal[g.id]} kcal
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmationModal
        open={!!picked}
        title="Thêm món vào danh mục của trường"
        message={`Chép "${picked?.name || ''}" và mở trang sửa món.`}
        confirmLabel="Thêm món"
        onConfirm={copy}
        onClose={() => setPicked(null)}
      >
        {missing.length > 0 && (
          <p className="td-lib-missing">
            Sẽ thêm {missing.length} thực phẩm trường chưa có: <b>{missing.join(', ')}</b> (kèm giá trị dinh dưỡng, chưa có đơn giá).
          </p>
        )}
      </ConfirmationModal>
    </SidePanel>
  );
}
