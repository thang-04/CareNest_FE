import { Button, TextField } from '@/components';
import { useEffect, useRef, useState } from 'react';
import { announcements } from '@/services/announcement/announcementService';

export default function AnnouncementAttachments({ existing = [], keepIds = [], onKeepChange, onFilesChange, readOnly = false }) {
  const [error, setError] = useState('');
  const urls = useRef(new Set());
  useEffect(() => {
    const active = urls.current;
    return () => {
      active.forEach(URL.revokeObjectURL);
      active.clear();
    };
  }, []);
  const download = async (file) => {
    try {
      const blob = await announcements.attachment(file.id);
      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }, 1000);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <fieldset className="stack gap-2">
      <legend>Tệp đính kèm</legend>
      {existing.map((file) => (
        <div key={file.id}>
          {!readOnly && (
            <label className="field">
              <TextField
                className=""
                type="checkbox"
                checked={keepIds.includes(file.id)}
                onChange={(e) => onKeepChange(e.target.checked ? [...keepIds, file.id] : keepIds.filter((id) => id !== file.id))}
              />{' '}
              Giữ{' '}
            </label>
          )}
          <Button type="button" className="btn" onClick={() => download(file)}>
            {file.fileName}
          </Button>
        </div>
      ))}
      {!readOnly && (
        <>
          <label className="field">
            Thêm tệp{' '}
            <TextField
              className="input"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf"
              onChange={(e) => onFilesChange([...e.target.files])}
            />
          </label>
          <p className="muted">Tối đa 5 tệp JPG, PNG hoặc PDF; mỗi tệp tối đa 10 MB.</p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
