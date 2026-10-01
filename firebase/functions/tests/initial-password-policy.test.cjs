const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInitialPassword } = require('../initial-password-policy.cjs');
test('initial replacement password cannot reuse short bootstrap passwords', () => {
  assert.equal(validateInitialPassword('Short2026!'), false);
  assert.equal(validateInitialPassword('LongEnough2026!'), true);
  for (const value of [null, {}, 'a'.repeat(20), 'A'.repeat(20), '1'.repeat(20), 'a'.repeat(129)]) assert.equal(validateInitialPassword(value), false);
});
