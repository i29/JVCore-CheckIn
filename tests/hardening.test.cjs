const { test } = require('node:test');
const assert = require('node:assert/strict');
const wallet = require('../wallet-compat.js');

test('Gas上限使用整数精确计算，不经过Number浮点转换', () => {
  assert.equal(wallet.calculateGasLimit('100000'), '120000');
  assert.equal(wallet.calculateGasLimit('9007199254740993'), '10808639105689192');
  assert.equal(wallet.calculateGasLimit(100001), '120002');
  assert.equal(wallet.calculateGasLimit('0x186a0'), '120000');
});
test('Gas估算值无效或不安全时拒绝计算', () => {
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, 'abc', '', null]) {
    assert.throws(() => wallet.calculateGasLimit(value));
  }
});
test('Provider候选列表不是数组时不会因展开异常而崩溃', () => {
  const provider = { request() {} };
  assert.equal(wallet.getProvider({ ethereum: { providers: provider } }), null);
});
test('账户返回值异常时会安全拒绝', async () => {
  const provider = { request: async ({ method }) => method === 'eth_chainId' ? '0xe52' : [null] };
  await assert.rejects(wallet.assertSession(provider, { chainId: '0xe52' }, '0x1111111111111111111111111111111111111111'));
});
test('签到实现包含会话版本校验及精确Gas计算', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /walletSessionEpoch/);
  assert.match(html, /calculateGasLimit\(gasEstimate\)/);
  assert.doesNotMatch(html, /Math\.ceil\(Number\(gasEstimate\)\s*\*\s*1\.2\)/);
});

test('成功提示必须核验交易哈希和CheckIn事件', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /receipt\\.transactionHash/);
  assert.match(html, /CheckIn\\(uint256,uint256,uint256\\)/);
  assert.match(html, /receipt\\.events && receipt\\.events\\.CheckIn/);
  assert.match(html, /链上签到事件已验证/);
});
