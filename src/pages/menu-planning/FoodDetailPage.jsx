import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useCatalogAccess, useCatalogLookups } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteFood } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Tabs } from '@/components/ui/Tabs';
import { useTabParam } from '@/hooks/useTabParam';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, HistoryCard, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { NutrientTable } from '@/components/menu-planning/NutrientTable';
import { InfoGrid } from '@/components/menu-planning/InfoGrid';
import { ContractStatusBadge } from '@/components/menu-planning/ContractStatusBadge';
import { hasNutrition, hasOrigin } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import {
  DISH_TYPE_LABELS,
  FOOD_GROUP_LABELS,
  FOOD_ORIGIN_LABELS,
  FOOD_STORAGE_LABELS,
  FOOD_UNIT_LABELS,
  formatMoney,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';
import { Button } from '@/components';

const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('vi-VN');

/**
 * Chi tiết thực phẩm (bố cục "bảng món dùng là chính"): dải thông tin ngắn; bảng định lượng của thực phẩm trong từng món
 * theo nhóm tuổi; bên cạnh là dinh dưỡng trong 100 g ăn được và quy đổi, đơn giá.
 */
export default function FoodDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { canManage, softDelete } = useCatalogAccess();
  const { catalog, loading: catLoading } = useCatalogLookups();
  const { item: f, loading, error, reload } = useFood(id);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [tab, setTab] = useTabParam(['info', 'dishes', 'history']);

  if (loading || catLoading) return <LoadingState />;
  if (error || !f)
    return (
      <div className="page">
        <Breadcrumb items={foodCrumbs('Chi tiết thực phẩm')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const remove = async () => {
    try {
      await deleteFood(id, user);
      toast.success(softDelete ? 'Đã chuyển sang Ngừng sử dụng.' : 'Đã xóa bản ghi.');
      navigate('/menu/foods');
    } catch (err) {
      setConfirm(false);
      setDeleteError(err.message);
    }
  };

  const groups = activeAgeGroups(catalog.nutritionSetups);
  const nut = f.nutrition;
  // Định lượng của thực phẩm này trong từng món (một trẻ), theo công thức món
  const used = f.usedInDishes.map((u) => {
    return {
      ...u,
      type: DISH_TYPE_LABELS[u.dishType] || '—',
      qty: groups.map((g) => {
        const found = u.portions.filter((p) => String(p.ageGroupId) === String(g.id));
        return found.length ? found.reduce((s, p) => s + Number(p.gramsPerChild), 0) : null;
      }),
    };
  });

  return (
    <div className="page">
      <Breadcrumb items={foodCrumbs(f.name)} />
      <div className="page__head">
        <div className="row td-title-row">
          <h1 className="page__title">{f.name}</h1>
          <RecordStatusBadge status={f.status} size="lg" />
        </div>
        {canManage && (
          <div className="row row--wrap td-actions">
            {!(softDelete && f.status === 'INACTIVE') && (
              <Button variant="outline-danger" onClick={() => setConfirm(true)}>
                <Trash2 size={16} /> {softDelete ? 'Ngừng sử dụng' : 'Xóa'}
              </Button>
            )}
            <Link className="btn btn--primary" to={`/menu/foods/${id}/edit`}>
              <Pencil size={16} /> Sửa thực phẩm
            </Link>
          </div>
        )}
      </div>
      {deleteError && (
        <div className="alert alert--danger mb-16">
          <AlertTriangle size={18} />
          <div>{deleteError}</div>
        </div>
      )}
      {!(hasNutrition(f) && hasOrigin(f)) && (
        <div className="alert alert--warning mb-16">
          <AlertTriangle size={18} />
          <div>
            Thực phẩm chưa đủ {hasNutrition(f) ? 'nguồn gốc (động vật / thực vật)' : 'số liệu dinh dưỡng'}; các món và thực đơn dùng thực
            phẩm này sẽ hiện "Chưa đủ dữ liệu" và chưa đánh giá cân đối.
          </div>
        </div>
      )}
      {/* Chia tab (DESIGN §6.3): thông tin + dinh dưỡng | món dùng thực phẩm | lịch sử */}
      <Tabs
        ariaLabel="Phần chi tiết thực phẩm"
        value={tab}
        onChange={setTab}
        items={[
          { key: 'info', label: 'Thông tin & dinh dưỡng' },
          { key: 'dishes', label: 'Dùng trong món', count: used.length },
          { key: 'history', label: 'Lịch sử' },
        ]}
      />
      <div className="tab-panel">
        {tab === 'info' && (
          // Hai thẻ xếp dọc, thành phần dinh dưỡng chiếm cả bề ngang để các ô chất đủ chỗ dàn ngang
          <div className="td-sections">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Thông tin chung</h2>
              </div>
              <div className="card__body">
                <InfoGrid
                  items={[
                    { label: 'Mã', value: <span className="fw-600">{f.code}</span> },
                    { label: 'Nhóm', value: FOOD_GROUP_LABELS[f.group] },
                    { label: 'Nguồn gốc', value: FOOD_ORIGIN_LABELS[f.origin] || <span className="td-warn">Chưa có</span> },
                    { label: 'Bảo quản', value: FOOD_STORAGE_LABELS[f.storage] || '—' },
                    { label: 'Đơn vị tính', value: f.purchaseUnit || '—' },
                    {
                      label: 'Quy đổi',
                      value: `1 ${f.purchaseUnit || 'đơn vị'} = ${(f.purchaseUnitSize ?? 0).toLocaleString('vi-VN')} ${FOOD_UNIT_LABELS[f.unit]}`,
                    },
                    { label: 'Tỷ lệ thải bỏ', value: `${f.wastePct ?? 0}%` },
                    {
                      label: 'Đơn giá',
                      value: (
                        <span className="fw-600">
                          {f.unitPrice == null ? 'Chưa có' : `${formatMoney(f.unitPrice)} / ${f.purchaseUnit}`}
                        </span>
                      ),
                    },
                    {
                      label: 'Nhà cung cấp',
                      value: f.supplierName ? (
                        <span className="td-chips">
                          {f.supplierName} <ContractStatusBadge status={f.contractStatus} size="sm" />
                        </span>
                      ) : (
                        <span className="td-warn">Chưa gán</span>
                      ),
                    },
                    { label: 'Hay dùng', value: f.favorite ? 'Có' : 'Không' },
                    { label: 'Chất gây dị ứng', wide: true, value: <AllergenChips allergens={f.allergens} empty="Không có" /> },
                    { label: 'Ghi chú', wide: true, value: f.note || '—' },
                  ]}
                />
              </div>
            </section>
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Thành phần dinh dưỡng</h2>
                <span className="text-sm muted">Trong 100 {f.unit} ăn được</span>
              </div>
              <div className="card__body">
                <NutrientTable
                  values={nut}
                  originNote={
                    hasNutrition(f) &&
                    hasOrigin(f) &&
                    `Đạm, béo tính vào phần ${FOOD_ORIGIN_LABELS[f.origin].toLowerCase()} khi cân đối khẩu phần.`
                  }
                  source={f.nutrientSource || 'chưa ghi'}
                />
              </div>
            </section>
          </div>
        )}
        {tab === 'dishes' && (
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Định lượng trong từng món (một trẻ)</h2>
              <span className="text-sm muted">{used.length} món · sửa định lượng ở trang món</span>
            </div>
            {used.length === 0 ? (
              <div className="card__body muted">Chưa có món nào dùng thực phẩm này.</div>
            ) : (
              <div className="table-wrap td-card-table">
                <table className="table table--grid">
                  <thead>
                    <tr>
                      <th>Món ăn</th>
                      <th>Loại</th>
                      {groups.map((g) => (
                        <th key={g.id} className="num">
                          {g.shortName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {used.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <Link to={`/menu/dishes/${u.id}`}>{u.name}</Link>
                        </td>
                        <td className="text-sm">{u.type}</td>
                        {u.qty.map((q, i) => (
                          <td key={groups[i].id} className="num nowrap">
                            {q == null ? <span className="td-warn">Chưa nhập</span> : `${n1(q)} ${f.unit}`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {tab === 'history' && <HistoryCard history={f.history} />}
      </div>
      <div className="page-actions">
        <Link className="btn" to="/menu/foods">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>
      <ConfirmationModal
        open={confirm}
        danger
        title={softDelete ? 'Ngừng sử dụng thực phẩm' : 'Xóa thực phẩm'}
        message={
          softDelete
            ? `Chuyển "${f.name}" sang Ngừng sử dụng? Món đã có giữ nguyên; món mới không chọn được thực phẩm này.`
            : `Xóa thực phẩm "${f.name}"? Thực phẩm đang dùng trong món ăn sẽ không xóa được.`
        }
        confirmLabel={softDelete ? 'Ngừng sử dụng' : 'Xóa thực phẩm'}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
