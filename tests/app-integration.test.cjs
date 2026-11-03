const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const helper = fs.readFileSync(path.join(__dirname, '../wallet-compat.js'), 'utf8');
const A = '0x1111111111111111111111111111111111111111';
function fixture(options = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window;
  w.console = { ...console, log() {}, warn() {}, error() {} };
  const listeners = new Map();
  let chain = options.chain || '0xe52';
  const calls = [];
  const provider = {
    async request({ method, params }) {
      calls.push(method);
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [A];
      if (method === 'eth_chainId') return chain;
      if (method === 'wallet_switchEthereumChain') {
        if (options.ignoreSwitch) return null;
        chain = params[0].chainId; return null;
      }
      throw new Error(method);
    },
    on(name, handler) { listeners.set(name, handler); },
    removeListener(name) { listeners.delete(name); },
  };
  w.okxwallet = provider; // 故意不提供 window.ethereum。
  let sent = 0, reads = 0;
  const contract = { methods: {
    balanceOf: () => ({ call: async () => options.balanceRead ? options.balanceRead(++reads) : '1' }),
    tokenOfOwnerByIndex: () => ({ call: async () => '0' }),
    tokenURI: () => ({ call: async () => 'data:application/json;base64,' + Buffer.from(JSON.stringify({ lastCheckInTime: '0' })).toString('base64') }),
    checkIn: () => ({
      estimateGas: async () => { if (options.estimateFails) throw new Error('模拟回滚'); if (options.accountChangeDuringEstimate) await listeners.get('accountsChanged')([]); return 100000; },
      send: async (args) => { sent++; assert.equal(args.from, A); return { status: options.receiptStatus ?? true }; },
    }),
  } };
  w.Web3 = class { constructor() { this.eth = { Contract: class { constructor() { return contract; } } }; } };
  w.eval(helper); w.eval(app + "\nwindow.__testApp = { AppState, CheckInManager };" );
  return { dom, w, provider, calls, listeners, get sent() { return sent; } };
}
test('本地托管的真实Web3脚本可以初始化，不依赖外部脚本', () => {
  const dom = new JSDOM('', { runScripts: 'outside-only', url: 'https://example.test/' });
  try {
    dom.window.eval(fs.readFileSync(path.join(__dirname, '../web3.min.js'), 'utf8'));
    assert.equal(typeof dom.window.Web3, 'function');
    assert.match(dom.window.Web3.version, /^1\./);
  } finally { dom.window.close(); }
});
test('仅欧易注入时实际页面连接成功，合约初始化并绑定正确provider事件', async () => {
  const f = fixture();
  try {
    await f.w.connectWallet();
    assert.equal(f.w.__testApp.AppState.userAccount, A);
    assert.equal(f.w.__testApp.AppState.areContractsReady() != null, true);
    assert.ok(f.listeners.has('chainChanged'));
    assert.equal(f.w.document.getElementById('connectBtn').style.display, 'none');
  } finally { f.dom.window.close(); }
});
test('实际页面切链被钱包忽略时不保留假连接', async () => {
  const f = fixture({ chain: '0x1', ignoreSwitch: true });
  try {
    await f.w.connectWallet();
    assert.equal(f.w.__testApp.AppState.userAccount, null);
    assert.equal(f.w.__testApp.AppState.areContractsReady(), null);
  } finally { f.dom.window.close(); }
});
test('欧易切到错误网络后清除合约与连接，不能继续签到', async () => {
  const f = fixture();
  try {
    await f.w.connectWallet();
    await f.listeners.get('chainChanged')('0x1');
    assert.equal(f.w.__testApp.AppState.userAccount, null);
    await f.w.__testApp.CheckInManager.performCheckIn();
    assert.equal(f.sent, 0);
  } finally { f.dom.window.close(); }
});
test('账户变化后清除旧连接，旧成员状态不能授权支付', async () => {
  const f = fixture();
  try {
    await f.w.connectWallet();
    await f.listeners.get('accountsChanged')([A]);
    assert.equal(f.w.__testApp.AppState.userAccount, null);
    await f.w.__testApp.CheckInManager.performCheckIn(); assert.equal(f.sent, 0);
  } finally { f.dom.window.close(); }
});
test('估算回滚不再降级固定gas并盲发', async () => {
  const f = fixture({ estimateFails: true });
  try {
    await f.w.connectWallet(); await f.w.__testApp.CheckInManager.performCheckIn();
    assert.equal(f.sent, 0); assert.equal(f.w.__testApp.CheckInManager.busy, false);
  } finally { f.dom.window.close(); }
});
test('双击签到只提交一次，成功回执才展示成功', async () => {
  const f = fixture();
  try {
    await f.w.connectWallet();
    await Promise.all([f.w.__testApp.CheckInManager.performCheckIn(), f.w.__testApp.CheckInManager.performCheckIn()]);
    assert.equal(f.sent, 1); assert.equal(f.w.__testApp.CheckInManager.busy, false);
    assert.equal(f.w.document.getElementById('statusMessage').textContent, '签到成功！🎉');
  } finally { f.dom.window.close(); }
});
test('失败回执不显示签到成功', async () => {
  const f = fixture({ receiptStatus: false });
  try {
    await f.w.connectWallet(); await f.w.__testApp.CheckInManager.performCheckIn();
    assert.equal(f.sent, 1);
    assert.equal(f.w.document.getElementById('statusMessage').textContent.includes('签到成功！🎉'), false);
    assert.equal(f.w.document.getElementById('statusMessage').classList.contains('error'), true);
  } finally { f.dom.window.close(); }
});
test('估算期间账户变化时不发送旧账户交易', async () => {
  const f = fixture({ accountChangeDuringEstimate: true });
  try {
    await f.w.connectWallet(); await f.w.__testApp.CheckInManager.performCheckIn();
    assert.equal(f.sent, 0);
  } finally { f.dom.window.close(); }
});
test('成员查询未返回时断连，旧查询不能恢复成员面板', async () => {
  let release;
  const f = fixture({ balanceRead: () => new Promise((resolve) => { release = resolve; }) });
  try {
    const connecting = f.w.connectWallet();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(typeof release, 'function');
    await f.listeners.get('accountsChanged')([]);
    release('1'); await connecting;
    assert.equal(f.w.__testApp.AppState.userAccount, null);
    assert.equal(f.w.document.getElementById('memberNumbers').style.display, 'none');
  } finally { f.dom.window.close(); }
});
