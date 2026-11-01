import { useEffect, useState } from 'react';
import { Search, X } from '@/components/ui/icons';

/**
 * Ô tìm kiếm bấm "Tìm" hoặc Enter mới lọc (danh sách lớn không lọc theo từng phím).
 * value = từ khóa đang áp dụng; onSearch(text) khi người dùng tìm hoặc xóa (× xóa và áp dụng ngay).
 */
export function SearchSubmit({ value = '', onSearch, placeholder = 'Tìm kiếm', label, maxLength = 60, className = '' }) {
  const [draft, setDraft] = useState(value);
  // Từ khóa đổi từ ngoài (Bỏ lọc, địa chỉ trang) thì ô nhập theo
  useEffect(() => setDraft(value), [value]);
  const submit = (event) => {
    event.preventDefault();
    onSearch(draft.trim());
  };
  return (
    <form className={`search-submit ${className}`} role="search" onSubmit={submit}>
      <label className="search-box">
        <Search size={16} className="muted" aria-hidden="true" />
        <span className="sr-only">{label || placeholder}</span>
        <input value={draft} placeholder={placeholder} maxLength={maxLength} onChange={(e) => setDraft(e.target.value)} />
        {draft && (
          <button
            type="button"
            className="search-submit__clear"
            aria-label="Xóa từ khóa"
            onClick={() => {
              setDraft('');
              onSearch('');
            }}
          >
            <X size={14} />
          </button>
        )}
      </label>
      <button type="submit" className="btn">
        Tìm
      </button>
    </form>
  );
}
