import { APPLIED_STRUCTURE_COLUMNS } from '@/utils/menu-planning/nutritionSetup';
import { DataTable, TextField } from '@/components';

/**
 * Cơ cấu áp dụng P:L:G của nhóm tuổi: tỷ lệ năng lượng từ đạm, béo và đường.
 */
export function NutritionAppliedStructure({ applied, canEdit, error, onChange }) {
  const columns = [
    {
      key: 'label',
      header: 'Chất dinh dưỡng',
      render: ({ key, label }) => (
        <span className={`td-applied__label td-col-${key === 'protein' ? 'p' : key === 'lipid' ? 'l' : 'g'}`}>{label}</span>
      ),
    },
    {
      key: 'ratio',
      header: 'Tỷ lệ năng lượng',
      className: 'num',
      render: ({ key, label }) => (
        <span className={`input-unit td-applied__value ${error ? 'is-invalid' : ''}`}>
          <TextField
            type="number"
            min={0}
            max={100}
            step="any"
            className="td-applied__input"
            value={applied?.[key] ?? ''}
            readOnly={!canEdit}
            aria-label={`Cơ cấu áp dụng ${label.toLowerCase()}`}
            aria-invalid={!!error}
            aria-describedby={error ? 'applied-structure-error' : undefined}
            onChange={(e) => onChange(key, e.target.value)}
          />
          <span>%</span>
        </span>
      ),
    },
  ];

  return (
    <div className="td-applied">
      <DataTable columns={columns} rows={APPLIED_STRUCTURE_COLUMNS} rowKey="key" className="table--compact td-applied__table" />
      {error && (
        <p id="applied-structure-error" className="field__error td-applied__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
