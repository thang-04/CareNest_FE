import { TextField } from '@/components/form/Field';

/**
 * Dải ô họ tên người ký đặt phía trên bản xem trước (khuôn "Văn bản trường"): chỉ đổi bản in / file xuất, không ghi hệ thống;
 * để trống thì bản in chừa chỗ ký tay. signers = [{ title, name }]; onChange(nextSigners). `children` thêm ô khác (vd. Tên file).
 */
export function PrintSignerFields({ signers, onChange, children }) {
  const setName = (i, name) => onChange(signers.map((s, k) => (k === i ? { ...s, name } : s)));
  return (
    <div className="print-signer-fields no-print">
      {children}
      {signers.map((s, i) => (
        <TextField
          key={s.title}
          label={`Họ tên ${s.title.toLowerCase()}`}
          hint="Để trống để ký tay"
          value={s.name || ''}
          maxLength={120}
          onChange={(e) => setName(i, e.target.value)}
        />
      ))}
    </div>
  );
}
