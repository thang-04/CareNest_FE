import { useCallback, useRef, useState } from 'react';
import { Plus, Search, Trash2, UserCheck } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { FormField } from '@/components/form/FormField';
import { ErrorState } from '@/components/ui/States';
import { ParentAccountBadge } from '@/components/children/ChildBadges';
import { GUARDIAN_RELATIONS } from '@/models/children/childrenConstants';
import { useClickOutside } from '@/hooks/useClickOutside';
import { normalizePhone } from '@/utils/children/childrenValidation';
import { normalizeText } from '@/utils/format';

const MAX_GUARDIANS = 3;

const childrenText = (a) => a.children.map((c) => `${c.fullName}${c.className ? ` (${c.className})` : ''}`).join(', ');

/** SĐT so khớp sau khi bỏ dấu cách/chấm ("0912 345" vẫn ra 0912345678); email và họ tên so khớp không dấu. */
const matches = (a, query) => {
  const q = normalizeText(query).trim();
  if (!q) return true;
  const phoneQ = normalizePhone(query);
  return (/^\d+$/.test(phoneQ) && a.phone.includes(phoneQ)) || normalizeText(`${a.email} ${a.fullName}`).includes(q);
};

/**
 * Enrollment step 1, "Đã có tài khoản": search box with in-flow results (no floating panel, so nothing covers it),
 * then the selected accounts as cards with the relation inline.
 * accounts: [{ id, fullName, phone, email, status, relation?, children: [{ id, fullName, className }] }]
 * value: [{ accountId, relation }]; errors keyed like 'guardians.0.relation'.
 */
export function ExistingGuardianPicker({ accounts, loading, error, onRetry, value, onChange, errors = {} }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(boxRef, close, open);

  if (loading)
    return (
      <div className="stack gap-3" aria-busy="true" aria-label="Đang tải tài khoản phụ huynh">
        <div className="skeleton tr-skel-input" />
        <div className="skeleton tr-skel-card" />
      </div>
    );
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (accounts.length === 0)
    return (
      <div className="alert alert--info">
        Điểm trường chưa có tài khoản phụ huynh nào. Chọn <b>Chưa có tài khoản</b> để nhập thông tin phụ huynh mới.
      </div>
    );

  const selectedIds = value.map((g) => g.accountId);
  const full = value.length >= MAX_GUARDIANS;
  const available = accounts.filter((a) => !selectedIds.includes(a.id));
  const results = available.filter((a) => matches(a, query));

  // Quan hệ điền sẵn theo hồ sơ anh/chị (nếu có) để đỡ nhập; người dùng vẫn sửa được.
  const add = (id) => {
    onChange([...value, { accountId: id, relation: accounts.find((a) => a.id === id)?.relation || '' }]);
    setQuery('');
    setOpen(false);
  };
  const remove = (id) => onChange(value.filter((g) => g.accountId !== id));
  const setRelation = (id, relation) => onChange(value.map((g) => (g.accountId === id ? { ...g, relation } : g)));

  return (
    <div className="stack gap-3">
      {full ? (
        <span className="muted text-sm">Đã chọn tối đa {MAX_GUARDIANS} phụ huynh.</span>
      ) : available.length > 0 ? (
        <div className="field tr-linked-add" ref={boxRef}>
          <label className="field__label" htmlFor="tr-account-search">
            {value.length ? 'Thêm phụ huynh khác' : 'Thêm phụ huynh'}
          </label>
          <div className="search-box">
            <Search size={17} className="muted" />
            <input
              id="tr-account-search"
              autoComplete="off"
              placeholder={`Tìm theo SĐT, email hoặc họ tên – ${available.length} tài khoản của điểm trường`}
              value={query}
              aria-expanded={open}
              aria-controls="tr-account-results"
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
            />
          </div>
          {open && (
            <div id="tr-account-results" className="tr-account-results" role="listbox" aria-label="Tài khoản phụ huynh">
              {results.length === 0 ? (
                <p className="muted text-sm tr-account-results__empty">
                  Không có tài khoản khớp “{query.trim()}”. Kiểm tra lại, hoặc chọn <b>Chưa có tài khoản</b> để nhập phụ huynh mới.
                </p>
              ) : (
                results.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="tr-account-result"
                    onClick={() => add(a.id)}
                  >
                    <span className="tr-account-option">
                      <span className="fw-600">{a.fullName}</span>
                      <span className="text-sm">
                        {a.phone}
                        {a.email ? ` · ${a.email}` : ''}
                      </span>
                      <span className="muted text-xs">Phụ huynh của: {childrenText(a)}</span>
                    </span>
                    <span className="tr-account-result__action">
                      <Plus size={15} /> Chọn
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <span className="muted text-sm">Đã chọn hết tài khoản phụ huynh của điểm trường.</span>
      )}

      {value.length === 0 ? (
        <div className="tr-linked-empty">
          <UserCheck size={18} className="muted" />
          <span className="muted text-sm">Chưa chọn phụ huynh nào. Tìm theo số điện thoại hoặc email ở ô phía trên để thêm.</span>
        </div>
      ) : (
        value.map((g, i) => {
          const a = accounts.find((x) => x.id === g.accountId);
          return (
            <div key={g.accountId} className="tr-guardian tr-linked">
              <Avatar user={a ? { fullName: a.fullName } : null} />
              <div className="tr-linked__info">
                <div className="row row--wrap gap-2">
                  <span className="fw-600">{a?.fullName || 'Tài khoản không còn trong điểm trường'}</span>
                  {a && <ParentAccountBadge status={a.status} />}
                </div>
                {a && (
                  <>
                    <span className="text-sm">
                      {a.phone}
                      {a.email ? ` · ${a.email}` : ''}
                    </span>
                    <span className="muted text-xs">Phụ huynh của: {childrenText(a)}</span>
                  </>
                )}
              </div>
              <div className="tr-linked__relation">
                <FormField
                  label="Quan hệ với trẻ"
                  required
                  error={errors[`guardians.${i}.relation`] || errors[`guardians.${i}.accountId`]}
                  hint={a?.relation && g.relation === a.relation ? 'Theo hồ sơ anh/chị, kiểm tra lại' : undefined}
                >
                  <select className="select" value={g.relation} onChange={(e) => setRelation(g.accountId, e.target.value)}>
                    <option value="">Chọn quan hệ</option>
                    {GUARDIAN_RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Bỏ chọn ${a?.fullName || `phụ huynh ${i + 1}`}`}
                title="Bỏ chọn"
                onClick={() => remove(g.accountId)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })
      )}

      {errors.guardians && (
        <div className="alert alert--danger" role="alert">
          {errors.guardians}
        </div>
      )}
    </div>
  );
}
