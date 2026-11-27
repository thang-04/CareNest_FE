import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const stripImports = (source) => source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
const sheet = await readFile(new URL('../../src/components/children/IntakeSheet.jsx', import.meta.url), 'utf8');
const field = await readFile(new URL('../../src/components/form/FormField.jsx', import.meta.url), 'utf8');
const { code } = await transformWithOxc(
  `import React, { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
  ${stripImports(field)}
  ${stripImports(sheet)}`,
  'IntakeSheet.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const { IntakeField } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);

for (const sheet of [true, false]) {
  test(`ô điện thoại ${sheet ? 'dạng phiếu' : 'thường'} giữ nhãn đúng input khi có thao tác đổi số`, () => {
    for (const withAction of [true, false]) {
      const html = renderToStaticMarkup(
        React.createElement(
          IntakeField,
          {
            sheet,
            label: 'Số điện thoại',
            error: 'Kiểm thử lỗi',
            action: withAction ? React.createElement('button', { type: 'button' }, 'Đổi số') : null,
          },
          React.createElement('input', { value: '0900000001', readOnly: true }),
        ),
      );
      const labelId = html.match(/<label[^>]*for="([^"]+)"/)[1];
      assert.ok(html.includes(`id="${labelId}"`));
      assert.match(html, /<input[^>]*aria-invalid="true"/);
      assert.ok(html.includes(`aria-describedby="${labelId}-error"`));
      assert.equal(html.includes('Đổi số'), withAction);
    }
  });
}
