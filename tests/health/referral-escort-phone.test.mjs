import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { validateDailyHealth } = await import('@/utils/dailyHealthValidation');

const check = (referral) =>
  validateDailyHealth({
    temperature: '38.2',
    observation: 'NOTED',
    symptoms: ['FEVER'],
    actions: ['REFERRAL'],
    referral: { place: 'Trạm y tế', time: '10:15', ...referral },
  });

test('người đi cùng phải kèm số điện thoại di động hợp lệ', () => {
  assert.match(check({ escort: 'Cô đi cùng' }).referral, /số điện thoại người đi cùng/);
  assert.match(check({ escort: 'Cô đi cùng', escortPhone: '12345' }).referral, /10 số/);
  assert.equal(check({ escort: 'Cô đi cùng', escortPhone: '0912 000 111' }).referral, undefined);
  assert.equal(check({ escort: 'Cô đi cùng', escortPhone: '+84912000111' }).referral, undefined);
});

test('không ghi người đi cùng thì không đòi số điện thoại', () => {
  assert.equal(check({ escort: '' }).referral, undefined);
});

test('form có ô số điện thoại và lịch sử hiện số đó', () => {
  const panel = readFileSync(new URL('../../src/components/DailyHealthPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /label="Số điện thoại người đi cùng"/);
  assert.match(panel, /entry\.referral\.escortPhone/);
});
