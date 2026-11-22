import { APPLIED_STRUCTURE_COLUMNS } from '@/utils/menu-planning/nutritionSetup';
import { TextField } from '@/components';

/**
 * Cơ cấu áp dụng P:L:G của nhóm tuổi: tỷ lệ năng lượng từ đạm, béo và đường.
 */
export function NutritionAppliedStructure({ applied, canEdit, error, onChange }) {
  return (
    <div className="td-applied">
      <div className="table-wrap">
        <table className="table table--grid table--compact td-applied__table">
          <thead>
            <tr>
              <th>Chất dinh dưỡng</th>
              <th className="num">Tỷ lệ năng lượng</th>
            </tr>
          </thead>
          <tbody>
            {APPLIED_STRUCTURE_COLUMNS.map(({ key, label }) => (
              <tr key={key}>
                <th scope="row" className={`td-col-${key === 'protein' ? 'p' : key === 'lipid' ? 'l' : 'g'}`}>
                  {label}
                </th>
                <td className="num">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p id="applied-structure-error" className="field__error td-applied__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
