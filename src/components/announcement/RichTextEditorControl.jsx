import { Bold as BoldMark } from '@tiptap/extension-bold';
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Italic as ItalicMark } from '@tiptap/extension-italic';
import { Link as LinkMark } from '@tiptap/extension-link';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { Underline as UnderlineMark } from '@tiptap/extension-underline';
import { UndoRedo } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { Button, LABELS, TextField } from '@/components';
import { Bold, Italic, Link2, List, ListNumbers, Redo2, Underline, Undo2, Unlink } from '@/components/ui/icons';
import { ALLOWED_URI, normalizeEditorHtml, normalizeLinkUrl } from '@/utils/announcement/richText.mjs';

// Chỉ nạp đúng bộ định dạng đã chốt (không dùng starter-kit): dán từ Word/web thì phần ngoài bộ này tự bị bỏ
const EXTENSIONS = [
  Document,
  Paragraph,
  Text,
  HardBreak,
  BoldMark,
  ItalicMark,
  UnderlineMark,
  BulletList,
  OrderedList,
  ListItem,
  UndoRedo,
  LinkMark.configure({
    openOnClick: false,
    autolink: false,
    linkOnPaste: false,
    defaultProtocol: 'https',
    isAllowedUri: (url) => ALLOWED_URI.test(url),
    HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
  }),
];

const textOf = (editor) => editor.getText({ blockSeparator: '\n\n' });
// Giữ vùng chọn trong trình soạn khi bấm nút thanh công cụ
const keepSelection = (event) => event.preventDefault();

/**
 * Ô soạn thảo có định dạng tối thiểu (đậm, nghiêng, gạch chân, danh sách, liên kết). Nặng nên chỉ nạp qua RichTextEditor.
 * `value` là HTML; mỗi lần người dùng sửa gọi `onChange(html, text)` ('' khi trống), `onStats(số ký tự chữ)` cả khi `value` đổi từ ngoài.
 */
export default function RichTextEditorControl({
  value,
  onChange,
  onStats,
  disabled = false,
  label,
  className = '',
  id,
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}) {
  const handlers = useRef({ onChange, onStats });
  handlers.current = { onChange, onStats };
  const lastHtml = useRef(normalizeEditorHtml(value));
  const [link, setLink] = useState({ open: false, url: '', error: '' });

  const attributes = {
    ...(id ? { id } : {}),
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': label || 'Nội dung',
    ...(invalid ? { 'aria-invalid': 'true' } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    class: 'rich-editor__content',
  };

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: lastHtml.current || '<p></p>',
    editable: !disabled,
    editorProps: { attributes },
    onUpdate: ({ editor: current }) => {
      const html = normalizeEditorHtml(current.getHTML());
      const text = textOf(current);
      lastHtml.current = html;
      handlers.current.onChange?.(html, text);
      handlers.current.onStats?.(text.trim().length);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // aria-invalid / aria-describedby đổi theo lỗi và gợi ý của ô
  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes } });
  }, [editor, invalid, describedBy, label, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Giá trị đổi từ ngoài (chọn mẫu, nhập từ tệp): nạp lại nội dung mà không coi là người dùng vừa gõ
  useEffect(() => {
    if (!editor) return;
    const next = normalizeEditorHtml(value);
    if (next === lastHtml.current) return;
    lastHtml.current = next;
    editor.commands.setContent(next || '<p></p>', { emitUpdate: false });
    handlers.current.onStats?.(textOf(editor).trim().length);
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            underline: current.isActive('underline'),
            bullet: current.isActive('bulletList'),
            ordered: current.isActive('orderedList'),
            link: current.isActive('link'),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  });

  if (!editor || !state) return <div className={`rich-editor ${className}`.trim()} aria-busy="true" />;

  const run = (command) => () => command(editor.chain().focus()).run();
  const mark = (name, active, text, Icon, command) => (
    <Button
      key={name}
      variant="icon"
      icon={Icon}
      aria-label={text}
      title={text}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={keepSelection}
      onClick={run(command)}
    />
  );

  const openLink = () => {
    if (link.open) return setLink({ open: false, url: '', error: '' });
    setLink({ open: true, url: editor.getAttributes('link').href || '', error: '' });
  };
  const applyLink = () => {
    const href = normalizeLinkUrl(link.url);
    if (!href) return setLink({ ...link, error: 'Địa chỉ phải là https://, mailto: hoặc tel:' });
    const chain = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Chưa chọn chữ: chèn chính địa chỉ làm chữ liên kết
      chain.insertContent({ type: 'text', text: link.url.trim(), marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain.extendMarkRange('link').setLink({ href }).run();
    }
    setLink({ open: false, url: '', error: '' });
  };
  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLink({ open: false, url: '', error: '' });
  };

  return (
    <div className={`rich-editor ${className}`.trim()} aria-disabled={disabled || undefined}>
      <div className="rich-editor__toolbar" role="toolbar" aria-label="Định dạng nội dung">
        {mark('bold', state.bold, 'Chữ đậm', Bold, (c) => c.toggleBold())}
        {mark('italic', state.italic, 'Chữ nghiêng', Italic, (c) => c.toggleItalic())}
        {mark('underline', state.underline, 'Gạch chân', Underline, (c) => c.toggleUnderline())}
        <span className="rich-editor__divider" aria-hidden="true" />
        {mark('bullet', state.bullet, 'Danh sách chấm', List, (c) => c.toggleBulletList())}
        {mark('ordered', state.ordered, 'Danh sách số', ListNumbers, (c) => c.toggleOrderedList())}
        <span className="rich-editor__divider" aria-hidden="true" />
        <Button
          variant="icon"
          icon={Link2}
          aria-label="Chèn liên kết"
          title="Chèn liên kết"
          aria-pressed={state.link || link.open}
          disabled={disabled}
          onMouseDown={keepSelection}
          onClick={openLink}
        />
        <span className="rich-editor__divider" aria-hidden="true" />
        <Button
          variant="icon"
          icon={Undo2}
          aria-label="Hoàn tác"
          title="Hoàn tác"
          disabled={disabled || !state.canUndo}
          onMouseDown={keepSelection}
          onClick={run((c) => c.undo())}
        />
        <Button
          variant="icon"
          icon={Redo2}
          aria-label="Làm lại"
          title="Làm lại"
          disabled={disabled || !state.canRedo}
          onMouseDown={keepSelection}
          onClick={run((c) => c.redo())}
        />
      </div>
      {link.open && (
        <div className="rich-editor__link" role="group" aria-label="Chèn liên kết">
          <TextField
            aria-label="Địa chỉ liên kết"
            placeholder="https://"
            autoFocus
            value={link.url}
            onChange={(e) => setLink({ ...link, url: e.target.value, error: '' })}
            onKeyDown={(e) => {
              // Enter ở ô này chỉ áp dụng liên kết, không gửi cả form soạn thông báo
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              }
              if (e.key === 'Escape') {
                e.stopPropagation();
                setLink({ open: false, url: '', error: '' });
              }
            }}
          />
          <Button size="sm" variant="primary" onClick={applyLink}>
            Áp dụng
          </Button>
          {state.link && (
            <Button size="sm" icon={Unlink} onClick={removeLink}>
              Gỡ liên kết
            </Button>
          )}
          <Button size="sm" onClick={() => setLink({ open: false, url: '', error: '' })}>
            {LABELS.close}
          </Button>
          {link.error && (
            <span className="field__error rich-editor__link-error" role="alert">
              {link.error}
            </span>
          )}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
