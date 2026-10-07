import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search, Trash2, LayoutGrid, Monitor, PlayCircle } from 'lucide-react';
import { useAvailableAssets } from '@/hooks/facility-transfer/useAvailableAssets';
import { normalizeText } from '@/utils/format';
import { locationLabel } from '@/models/Location';
import { AssetThumb, ConditionSelect, categoryIcon } from '@/components/asset/AssetVisuals';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, SkeletonRows, EmptyState } from '@/components/ui/States';
import { ASSET_CONDITION_LABELS } from '@/models/Asset';

/** Bước 2 – Chọn tài sản (LuanChuyen2 mockup). Only assets at the sending location. */
export function StepSelectAssets({ wizard, md, transferId }) {
  const { form, errors, toggleAsset, updateItem, clearItems, setAvailableById, totals } = wizard;
  const { assets, loading, error, reload } = useAvailableAssets(form.fromLocationId, transferId);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('ALL');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setAvailableById(Object.fromEntries(assets.map((a) => [a.id, a.availableQuantity])));
  }, [assets, setAvailableById]);

  const from = md.locationById(form.fromLocationId);
  const to = md.locationById(form.toLocationId);
  const selected = useMemo(() => Object.fromEntries(form.items.map((i) => [i.assetId, i])), [form.items]);

  const counts = useMemo(() => assets.reduce((acc, a) => ({ ...acc, [a.categoryId]: (acc[a.categoryId] || 0) + 1 }), {}), [assets]);
  const visible = assets.filter(
    (a) =>
      (category === 'ALL' || a.categoryId === category) &&
      (!keyword || normalizeText(`${a.code} ${a.name}`).includes(normalizeText(keyword))),
  );
  const allVisibleSelected = visible.length > 0 && visible.filter((a) => a.availableQuantity > 0).every((a) => selected[a.id]);

  const toggleAllVisible = (checked) => {
    visible.forEach((a) => {
      if (a.availableQuantity <= 0) return;
      if (checked && !selected[a.id]) toggleAsset(a, true);
      if (!checked && selected[a.id]) toggleAsset(a, false);
    });
  };

  return (
    <section className="card wizard-card">
      <h2 className="section-title">Chọn tài sản luân chuyển</h2>
      <div className="row row--between mb-16" style={{ alignItems: 'stretch' }}>
        <div className="route-banner">
          <Monitor size={22} className="text-primary" />
          <div>
            <div>
              <b>Từ:</b> {locationLabel(from)}
            </div>
            <div className="text-2">{md.campusById(form.fromCampusId)?.name}</div>
          </div>
          <ArrowRight size={28} className="text-primary route-banner__arrow" />
          <PlayCircle size={22} className="text-primary" />
          <div>
            <div>
              <b>Đến:</b> {locationLabel(to)}
            </div>
            <div className="text-2">{md.campusById(form.toCampusId)?.name}</div>
          </div>
        </div>
        <label className="search-box" style={{ alignSelf: 'center' }}>
          <Search size={17} className="muted" />
          <input
            placeholder="Tìm kiếm tài sản (mã, tên, ...)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="Tìm kiếm tài sản"
          />
        </label>
      </div>

      <div className="asset-layout">
        <aside className="category-list">
          <div className="category-list__title">Danh mục tài sản</div>
          <button className={`category-item ${category === 'ALL' ? 'category-item--active' : ''}`} onClick={() => setCategory('ALL')}>
            <LayoutGrid size={18} /> Tất cả ({assets.length})
          </button>
          {md.categories
            .filter((c) => counts[c.id])
            .map((c) => {
              const Icon = categoryIcon(c.id);
              return (
                <button
                  key={c.id}
                  className={`category-item ${category === c.id ? 'category-item--active' : ''}`}
                  onClick={() => setCategory(c.id)}
                >
                  <Icon size={18} /> {c.name} ({counts[c.id]})
                </button>
              );
            })}
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap">
              <table className="table asset-table">
                <thead>
                  <tr>
                    <th className="center" style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        className="cb"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleAllVisible(e.target.checked)}
                        aria-label="Chọn tất cả"
                      />
                    </th>
                    <th className="center">STT</th>
                    <th>Mã tài sản</th>
                    <th>Tên tài sản</th>
                    <th className="center">Đơn vị</th>
                    <th className="center" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
                      Số lượng hiện tại
                      <br />
                      (tại nơi đi)
                    </th>
                    <th className="center" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
                      Số lượng
                      <br />
                      luân chuyển
                    </th>
                    <th>Tình trạng</th>
                    <th className="center">Hình ảnh</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows rows={5} cols={10} />
                  ) : visible.length === 0 ? (
                    <tr>
                      <td colSpan={10}>
                        <EmptyState
                          title={assets.length ? 'Không tìm thấy tài sản phù hợp' : 'Nơi đi chưa có tài sản'}
                          description={assets.length ? 'Thử đổi từ khóa hoặc danh mục.' : 'Hãy chọn nơi đi khác ở bước 1.'}
                        />
                      </td>
                    </tr>
                  ) : (
                    visible.map((asset, idx) => {
                      const item = selected[asset.id];
                      const reserved = asset.quantity - asset.availableQuantity;
                      const err = errors[`item_${asset.id}`];
                      return (
                        <tr key={asset.id} className={item ? 'row--selected' : ''}>
                          <td className="center">
                            <input
                              type="checkbox"
                              className="cb"
                              checked={!!item}
                              disabled={asset.availableQuantity <= 0}
                              onChange={(e) => toggleAsset(asset, e.target.checked)}
                              aria-label={`Chọn ${asset.name}`}
                            />
                          </td>
                          <td className="center">{idx + 1}</td>
                          <td>{asset.code}</td>
                          <td>{asset.name}</td>
                          <td className="center">{asset.unit}</td>
                          <td className="center">
                            {asset.availableQuantity}
                            {reserved > 0 && <div className="muted text-xs">({reserved} đang ở phiếu khác)</div>}
                          </td>
                          <td className="center" style={{ width: 130 }}>
                            <input
                              type="number"
                              min={1}
                              max={asset.availableQuantity}
                              className={`input qty-input ${err ? 'input--error' : ''}`}
                              value={item ? item.quantity : 0}
                              disabled={!item}
                              onChange={(e) => updateItem(asset.id, { quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                              aria-label={`Số lượng luân chuyển ${asset.name}`}
                            />
                            {err && <div className="field__error text-xs">{err}</div>}
                          </td>
                          <td style={{ width: 150 }}>
                            <ConditionSelect
                              value={item ? item.condition : asset.condition}
                              disabled={!item}
                              onChange={(v) => updateItem(asset.id, { condition: v })}
                            />
                          </td>
                          <td className="center">
                            <AssetThumb asset={asset} />
                          </td>
                          <td className="center">
                            <button className="icon-btn text-primary" onClick={() => setDetail(asset)} aria-label={`Xem ${asset.name}`}>
                              <Search size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {errors.items && <div className="alert alert--danger mt-12">{errors.items}</div>}

      <div className="row row--between mt-16">
        <div className="row" style={{ gap: 20 }}>
          <span>
            Đã chọn <b>{totals.count}</b> tài sản
          </span>
          <button className="btn btn--outline-danger" onClick={clearItems} disabled={!totals.count}>
            <Trash2 size={16} /> Bỏ chọn
          </button>
        </div>
        <div className="text-lg">
          Tổng số lượng luân chuyển: <b className="text-primary text-h2">{totals.quantity}</b>
        </div>
      </div>

      <Modal open={!!detail} title="Thông tin tài sản" onClose={() => setDetail(null)}>
        {detail && (
          <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
            <span className="asset-thumb" style={{ width: 120, height: 90 }}>
              <AssetThumb asset={detail} />
            </span>
            <dl className="info-list" style={{ flex: 1 }}>
              <dt>Mã tài sản:</dt>
              <dd>{detail.code}</dd>
              <dt>Tên tài sản:</dt>
              <dd>{detail.name}</dd>
              <dt>Danh mục:</dt>
              <dd>{md.categoryById(detail.categoryId)?.name}</dd>
              <dt>Vị trí:</dt>
              <dd>{locationLabel(from)}</dd>
              <dt>Tồn tại nơi đi:</dt>
              <dd>
                {detail.quantity} {detail.unit}
              </dd>
              <dt>Có thể luân chuyển:</dt>
              <dd>
                {detail.availableQuantity} {detail.unit}
              </dd>
              <dt>Tình trạng:</dt>
              <dd>{ASSET_CONDITION_LABELS[detail.condition]}</dd>
            </dl>
          </div>
        )}
      </Modal>
    </section>
  );
}
