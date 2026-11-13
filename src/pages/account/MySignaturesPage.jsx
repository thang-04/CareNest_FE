import { useState } from 'react';
import { Breadcrumb } from '@/components';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { acCrumbs } from '@/utils/account/breadcrumbs';
import '@/styles/modules/account.css';

/** Chữ ký của tôi: tải ảnh chữ ký, đặt mặc định, xóa; các biên bản cần ký dùng lại chữ ký đã lưu ở đây. */
export default function MySignaturesPage() {
  const [current, setCurrent] = useState({ url: null, id: null });

  return (
    <div className="page">
      <Breadcrumb items={acCrumbs('Chữ ký của tôi')} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Chữ ký của tôi</h1>
          <p className="muted text-sm">
            Tải ảnh chữ ký của bạn một lần để dùng khi ký biên bản. Chữ ký đã ký vào biên bản được giữ nguyên, dù sau này bạn đổi hoặc xóa
            chữ ký.
          </p>
        </div>
      </div>
      <section className="card">
        <div className="card__body">
          <SignaturePicker value={current.url} onChange={setCurrent} />
        </div>
      </section>
    </div>
  );
}
