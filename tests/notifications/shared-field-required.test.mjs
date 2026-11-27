import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('các trường chung giữ kiểm tra bắt buộc của trình duyệt', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { TextField, TextAreaField, SelectField } = await server.ssrLoadModule('/src/components/form/Field.jsx');
    for (const Field of [TextField, TextAreaField, SelectField]) {
      const html = renderToStaticMarkup(React.createElement(Field, { required: true, 'aria-label': 'Bắt buộc' }));
      assert.match(html, /\srequired=""/);
      const optional = renderToStaticMarkup(React.createElement(Field, { 'aria-label': 'Tùy chọn' }));
      assert.doesNotMatch(optional, /\srequired=/);
    }
  } finally {
    await server.close();
  }
});
