/* 本地钱包兼容层：无网络依赖，可在浏览器和 Node.js 中测试。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JVWallet = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function getProvider(win) {
    const candidates = [win.okxwallet && win.okxwallet.ethereum, win.okxwallet,
      ...(win.ethereum && win.ethereum.providers || []), win.ethereum];
    return candidates.find((p) => p && typeof p.request === 'function') || null;
  }
  function errorDetails(error) {
    const pending = [error], seen = new Set(), codes = [], messages = [];
    while (pending.length && seen.size < 20) {
      const current = pending.shift();
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);
      if (current.code !== undefined) codes.push(Number(current.code));
      if (typeof current.message === 'string') messages.push(current.message);
      pending.push(current.cause, current.error, current.data, current.originalError);
    }
    return { codes, message: messages.join(' ') };
  }
  function sameChain(actual, expected) {
    try { return BigInt(actual) === BigInt(expected); } catch { return false; }
  }
  async function ensureChain(provider, network) {
    if (!provider) throw new Error('未检测到可用钱包，请在欧易或小狐狸钱包浏览器内打开');
    if (sameChain(await provider.request({ method: 'eth_chainId' }), network.chainId)) return;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.chainId }] });
    } catch (error) {
      const details = errorDetails(error);
      // 用户拒绝、请求已挂起、方法不可用不可被当成“缺少网络”。
      if (details.codes.some((code) => [4001, -32002, -32601, 4200].includes(code))) throw error;
      const unknown = details.codes.includes(4902)
        || /unrecogni[sz]ed chain|unknown chain|chain.*not.*(added|exist|found|support)|未添加.*网络|网络.*未添加|网络不存在|链不存在|不支持.*(链|网络)/i.test(details.message);
      if (!unknown) throw new Error('自动切换失败，请在钱包中手动添加或切换焦耳链后重试：' + details.message);
      await provider.request({ method: 'wallet_addEthereumChain', params: [network] });
      // 部分钱包“添加”并不切换；显式补切链并核对结果。
      if (!sameChain(await provider.request({ method: 'eth_chainId' }), network.chainId)) {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: network.chainId }] });
      }
    }
    if (!sameChain(await provider.request({ method: 'eth_chainId' }), network.chainId)) {
      throw new Error('钱包仍未切换到焦耳链，已阻止后续合约操作');
    }
  }
  async function assertSession(provider, network, expectedAccount) {
    if (!provider || !expectedAccount) throw new Error('钱包未连接');
    const chain = await provider.request({ method: 'eth_chainId' });
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (!sameChain(chain, network.chainId)) throw new Error('网络不正确，已阻止签到，请重新连接');
    if (!accounts[0] || accounts[0].toLowerCase() !== expectedAccount.toLowerCase()) {
      throw new Error('钱包账户已变化，已阻止签到，请重新连接');
    }
  }
  return { getProvider, errorDetails, sameChain, ensureChain, assertSession };
});
