import { Armchair, BookOpen, Monitor, Backpack, CookingPot, Package } from 'lucide-react';
import { ASSET_CONDITION_LABELS, CONDITION_OPTIONS } from '@/models/Asset';

const CATEGORY_ICONS = {
  cat_furniture: Armchair,
  cat_teaching: BookOpen,
  cat_electronic: Monitor,
  cat_classroom: Backpack,
  cat_kitchen: CookingPot,
  cat_other: Package,
};

export const categoryIcon = (categoryId) => CATEGORY_ICONS[categoryId] || Package;

/** Asset photo, or a category illustration when there is no photo. */
export function AssetThumb({ asset, size, onClick }) {
  const Icon = categoryIcon(asset?.categoryId);
  return (
    <span
      className={`asset-thumb ${size === 'sm' ? 'asset-thumb--sm' : ''}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `Xem ảnh ${asset?.assetName || asset?.name || 'tài sản'}`,
            onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && onClick(e),
          }
        : {})}
    >
      {asset?.imageUrl ? <img src={asset.imageUrl} alt={asset.assetName || asset.name} /> : <Icon size={size === 'sm' ? 18 : 22} />}
    </span>
  );
}

const CONDITION_CLASS = {
  GOOD: 'cond--good',
  NORMAL: 'cond--normal',
  NEED_REPAIR: 'cond--need-repair',
  BROKEN: 'cond--broken',
};

export function ConditionBadge({ value }) {
  if (!value) return <span className="muted">—</span>;
  return <span className={`cond ${CONDITION_CLASS[value] || ''}`}>{ASSET_CONDITION_LABELS[value]}</span>;
}

export function ConditionSelect({ value, onChange, disabled, error, ariaLabel = 'Tình trạng' }) {
  return (
    <select
      className={`select ${error ? 'select--error' : ''} ${value ? `cond-select--filled ${CONDITION_CLASS[value] || ''}` : ''}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {!value && <option value="">Chọn...</option>}
      {CONDITION_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
