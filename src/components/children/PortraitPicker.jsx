import { useEffect, useId, useRef, useState } from 'react';
import { Upload, Trash2, UserRound } from '@/components/ui/icons';
import { PortraitImage } from '@/components/PortraitImage';
import { PORTRAIT_ACCEPT, portraitFileError } from '@/utils/children/enrollmentPhotos';

export function PortraitPicker({ label, file, identity, onChange, error, disabled, embedded = false, inputId, labelledBy }) {
  const generatedId = useId();
  const id = inputId || generatedId;
  const input = useRef(null);
  const [localError, setLocalError] = useState('');
  useEffect(() => setLocalError(''), [file, identity]);
  return (
    <div className={embedded ? 'tr-portrait-picker' : 'field'}>
      {!embedded && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="row row--wrap gap-3">
        <PortraitImage source={file} alt={label} className="avatar avatar--xl avatar--photo">
          {embedded ? (
            // Khung ảnh trống cùng cỡ ảnh thật: biết trước chỗ ảnh sẽ hiện, không nhảy bố cục khi tải lên
            <span className="tr-portrait-empty" aria-hidden="true">
              <UserRound size={28} />
            </span>
          ) : (
            <span className="avatar avatar--xl muted" aria-hidden="true">
              —
            </span>
          )}
        </PortraitImage>
        <div className="stack gap-2">
          <input
            ref={input}
            id={id}
            className="sr-only"
            type="file"
            accept={PORTRAIT_ACCEPT}
            disabled={disabled}
            aria-labelledby={labelledBy}
            aria-describedby={localError || error ? `${id}-error` : undefined}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              event.target.value = '';
              if (!selected) return;
              const message = portraitFileError(selected);
              setLocalError(message);
              if (!message) onChange(selected);
            }}
          />
          <div className="row row--wrap gap-2">
            <button type="button" className="btn btn--sm" disabled={disabled} onClick={() => input.current?.click()}>
              <Upload size={15} /> {file ? 'Thay ảnh' : 'Tải ảnh lên'}
            </button>
            {file && (
              <button
                type="button"
                className="btn btn--sm"
                disabled={disabled}
                onClick={() => {
                  setLocalError('');
                  onChange(null);
                }}
              >
                <Trash2 size={15} /> Bỏ ảnh
              </button>
            )}
          </div>
        </div>
      </div>
      {(localError || error) && (
        <span id={`${id}-error`} className="field__error" role="alert">
          {localError || error}
        </span>
      )}
    </div>
  );
}
