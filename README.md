# Adsterra Code Exporter

在 Adsterra 发布商后台，每个网站名称后添加一个「复制全部广告代码」按钮。一键展开广告位、依次读取 GET CODE 弹窗，将该网站的广告代码合并到剪贴板。

A small Manifest V3 browser extension that adds a **Copy all ad codes** button next to each website on the Adsterra publisher dashboard. No separate popup or floating panel.

## 功能

- 网站折叠时也能点击，自动展开广告位。
- 逐个读取并关闭代码弹窗，保留完整脚本和 Native Banner 容器。
- 按网站合并代码，附带 HTML 注释分隔各广告位。
- 按钮显示进度与成功数量；失败时显示原因，不用残缺结果覆盖剪贴板。
- 不需要 API key，不上传广告代码，没有运行时第三方依赖。

## 安装（Chrome / Edge）

1. 下载本仓库 ZIP 并解压，或 `git clone https://github.com/NICKLING017/adsterra-code-exporter.git`。
2. 打开 `chrome://extensions`（Edge 使用 `edge://extensions`），开启开发者模式。
3. 点击「加载已解压的扩展程序」，选择包含 `manifest.json` 的仓库根目录。
4. 登录 Adsterra 发布商后台，打开 Websites 页面并刷新。
5. 点击网站名称后的「复制全部广告代码」。等待显示「已复制 N/N」后粘贴即可。

安装无需 Node.js、npm 或构建步骤。更新文件后需要在扩展管理页重新加载插件，并刷新 Adsterra 页面。

## 工作方式与权限

`content.js` 在匹配的 Adsterra 页面中运行，识别网站展开控件，触发已有 GET CODE 按钮并读取弹窗中的文本。复制完成后关闭由插件打开的弹窗。`content.css` 只负责按钮和错误提示样式。

- `clipboardWrite`：将用户主动请求的广告代码写入剪贴板。
- Adsterra 域名匹配：在 `*.adsterra.com`、`*.adsterra.cc`、`*.adsterra.cfd` 上注入脚本。
- 插件不读取密码或 Cookie，不添加统计追踪，不向自建服务发送数据。网站自身正常请求不受影响。

## 使用边界

- 这是非官方项目，与 Adsterra 无隶属关系。
- 依赖后台网页结构，后台改版可能需要更新选择器。
- 当前处理所选网站已加载的广告位，不自动跨广告位分页。
- 网站总数与可获取代码的广告位数量必须一致。待审核、不可用或未加载的广告位会导致超时提示，而非部分成功。
- 输出用于收集代码；接入网站时应按广告位选择放置位置。复制成功不代表广告在目标站点已展示。

## 开发与测试

需要 Node.js 22 或更高版本：

```bash
npm ci
npm run check
npm test
```

测试使用 jsdom 的模拟页面，覆盖：折叠网站按钮注入、无表格角色的页面结构、自动展开、分批加载、四段完整代码、弹窗关闭、连续复制、按钮文字不污染广告位数量，以及超时不覆盖剪贴板。

这些是本地回归测试，不替代真实后台验证。已在真实后台核对 Native Banner、Social Bar、320×50 和 300×250 的代码内容；2.1.2 的连续点击修复通过本地回归，仍需在重新加载后的浏览器中验证。

重新生成随仓库提供的图标：

```bash
npm run icons
```

## 反馈

提交 Issue 时请提供插件版本、浏览器版本、按钮上的错误提示及复现步骤。不要提交账号凭据或未经脱敏的后台截图。

## License

MIT © 2026 NICKLING017
