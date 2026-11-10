const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wallet = require('../wallet-compat.js');
const network = { chainId: '0xe52', rpcUrls: ['https://rpc.jnsdao.com'] };
const A = '0x1111111111111111111111111111111111111111';

function provider(options = {}) {
  let chain = options.chain || '0x1';
  const calls = [];
  let switched = 0;
  return { calls, async request({ method, params }) {
    calls.push({ method, params });
    if (method === 'eth_chainId') return chain;
    if (method === 'eth_accounts') return [options.account || A];
    if (method === 'wallet_switchEthereumChain') {
      switched++;
      if (options.error && switched === 1) throw options.error;
      if (!options.ignoreSwitch) chain = params[0].chainId;
      return null;
    }
    if (method === 'wallet_addEthereumChain') {
      if (options.addError) throw options.addError;
      if (options.addSwitches) chain = network.chainId;
      return null;
    }
    throw new Error(method);
  } };
}
test('优先识别欧易独立注入，无 window.ethereum 也可用', () => {
  const okx = { request() {} }, meta = { request() {} };
  assert.equal(wallet.getProvider({ okxwallet: okx, ethereum: meta }), okx);
  assert.equal(wallet.getProvider({ okxwallet: { ethereum: okx } }), okx);
  assert.equal(wallet.getProvider({ ethereum: meta }), meta);
  assert.equal(wallet.getProvider({}), null);
});
test('已在目标链时不反复请求切链', async () => {
  const p = provider({ chain: '0xe52' }); await wallet.ensureChain(p, network);
  assert.deepEqual(p.calls.map((c) => c.method), ['eth_chainId']);
});
test('正常切链后校验实际链编号', async () => {
  const p = provider(); await wallet.ensureChain(p, network);
  assert.equal(p.calls.at(-1).method, 'eth_chainId');
});
for (const error of [{ code: 4902 }, { data: { originalError: { code: '4902' } } },
  { code: -32603, message: 'Unrecognized chain ID. Try adding the chain first.' },
  { code: 5000, message: '网络不存在' }]) {
  test('缺少网络时兼容不同错误包装：' + JSON.stringify(error), async () => {
    const p = provider({ error }); await wallet.ensureChain(p, network);
    assert.equal(p.calls.filter((c) => c.method === 'wallet_addEthereumChain').length, 1);
    assert.equal(p.calls.filter((c) => c.method === 'wallet_switchEthereumChain').length, 2);
    assert.deepEqual(p.calls.find((c) => c.method === 'wallet_addEthereumChain').params, [network]);
  });
}
test('添加时钱包已自动切换，则不重复弹出切链', async () => {
  const p = provider({ error: { code: 4902 }, addSwitches: true }); await wallet.ensureChain(p, network);
  assert.equal(p.calls.filter((c) => c.method === 'wallet_switchEthereumChain').length, 1);
});
for (const code of [4001, -32002, -32601, 4200]) {
  test('拒绝、请求挂起或方法不支持不触发添加：' + code, async () => {
    const p = provider({ error: { cause: { code }, message: 'unknown chain' } });
    await assert.rejects(wallet.ensureChain(p, network));
    assert.equal(p.calls.some((c) => c.method === 'wallet_addEthereumChain'), false);
  });
}
test('未知内部错误不能误当缺少网络并绕过', async () => {
  const p = provider({ error: { code: -32603, message: 'Internal error' } });
  await assert.rejects(wallet.ensureChain(p, network), /手动/);
  assert.equal(p.calls.some((c) => c.method === 'wallet_addEthereumChain'), false);
});
test('钱包声称切链成功但实际没切换时阻断', async () => {
  await assert.rejects(wallet.ensureChain(provider({ ignoreSwitch: true }), network), /仍未切换/);
});
test('添加被拒绝时不能宣布连接成功', async () => {
  const p = provider({ error: { code: 4902 }, addError: new Error('用户拒绝') });
  await assert.rejects(wallet.ensureChain(p, network), /用户拒绝/);
});
test('签名前验证账户与网络，支持数值形式链编号', async () => {
  await wallet.assertSession(provider({ chain: '3666' }), network, A);
  await assert.rejects(wallet.assertSession(provider(), network, A), /网络不正确/);
  await assert.rejects(wallet.assertSession(provider({ chain: '0xe52', account: '0x2' }), network, A), /账户已变化/);
});
test('错误对象循环引用不会导致无限递归', () => {
  const e = { code: 4902 }; e.cause = e;
  assert.deepEqual(wallet.errorDetails(e).codes, [4902]);
});
test('入口仅使用本地Web3和兼容脚本，节点配置无旧端口', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['./web3.min.js', './wallet-compat.js']);
  assert.equal(html.includes(':8503'), false);
  for (const source of scripts) assert.equal(fs.existsSync(path.join(__dirname, '..', source)), true);
  for (const [, source] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(source);
});
