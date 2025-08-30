# JVote 签到 DApp

一个基于区块链的酷炫签到系统，支持EVM钱包连接和JVCore成员验证。

## 功能特性

- 🔗 **EVM钱包连接**: 支持MetaMask等主流钱包
- 🎯 **一键签到**: 简单直观的签到操作
- 👥 **成员验证**: 自动检查JVCore NFT持有状态
- 🎨 **酷炫界面**: 现代化的渐变设计和动画效果
- 📱 **响应式设计**: 完美适配各种设备
- ⚡ **单页应用**: 无需刷新的流畅体验

## 快速开始

### 1. 环境准备

- 安装 [MetaMask](https://metamask.io/) 浏览器插件
- 确保钱包连接到正确的区块链网络

### 2. 配置合约地址

在 `index.html` 文件中修改以下合约地址：

```javascript
// 合约地址 - 需要根据实际部署地址修改
const JVOTE_CONTRACT_ADDRESS = '0x...';
const JVCORE_CONTRACT_ADDRESS = '0x...';
```

### 3. 启动应用

直接在浏览器中打开 `index.html` 文件即可使用。

## 使用说明

### 连接钱包
1. 点击「连接钱包」按钮
2. 在MetaMask中确认连接
3. 系统会自动检查您的JVCore成员状态

### 签到操作
1. 确保钱包已连接
2. 点击「立即签到」按钮
3. 在MetaMask中确认交易
4. 等待交易确认完成

### 成员验证
- 系统会自动检查您持有的JVCore NFT数量
- 只有JVCore成员才能进行签到操作
- 成员状态会实时显示在界面上

## 技术架构

### 前端技术
- **HTML5**: 语义化标记
- **CSS3**: 现代化样式和动画
- **JavaScript**: 原生JS实现
- **Web3.js**: 区块链交互库

### 智能合约
- **签到合约**: 处理用户签到逻辑
- **JVCore合约**: NFT成员验证
- **EVM兼容**: 支持以太坊及其兼容链

## 文件结构

```
j-checkin/
├── index.html          # 主页面文件
├── jvote.abi.js       # 合约ABI定义
└── README.md          # 说明文档
```

## 合约接口

### JVote 签到合约

- `checkIn()`: 执行签到操作
- `getCheckInCount(address)`: 获取用户签到次数
- `getLastCheckInTime(address)`: 获取最后签到时间
- `canCheckInToday(address)`: 检查今日是否可签到

### JVCore NFT 合约

- `balanceOf(address)`: 获取NFT持有数量
- `tokenOfOwnerByIndex(address, index)`: 获取指定索引的Token ID
- `tokenURI(tokenId)`: 获取Token元数据URI
- `ownerOf(tokenId)`: 获取Token所有者

## 安全说明

- 所有交易都需要用户在钱包中确认
- 合约地址请务必验证正确性
- 建议在测试网络上先进行测试
- 注意保护好您的私钥和助记词

## 浏览器兼容性

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 故障排除

### 常见问题

1. **钱包连接失败**
   - 检查是否安装MetaMask
   - 确认网络连接正常
   - 尝试刷新页面重新连接

2. **签到交易失败**
   - 检查钱包余额是否足够支付Gas费
   - 确认合约地址配置正确
   - 检查是否为JVCore成员

3. **成员状态显示错误**
   - 确认JVCore合约地址正确
   - 检查网络连接状态
   - 尝试重新连接钱包

## 开发说明

如需修改或扩展功能，请注意：

1. 修改合约地址时，确保ABI与合约匹配
2. 添加新功能时，保持代码的简洁性
3. 测试所有交互功能的正常工作
4. 保持界面的响应式设计

## 许可证

MIT License

---

**注意**: 这是一个演示项目，实际使用前请确保合约已正确部署并经过安全审计。