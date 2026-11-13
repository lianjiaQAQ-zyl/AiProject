# 网页对照翻译

这是一个自用的桌面 Chrome 扩展。打开英文文章，点击「翻译当前页」，扩展用 DeepSeek 将英文翻成简体中文。正文逐段对照，按钮、导航等紧凑区域优先在原位置显示。API Key 由电脑上的本地服务读取，待译正文会发送给 DeepSeek。

## 准备

- Node.js 22.18 或以上版本，以及随附的 npm。
- 桌面 Chrome 120 或以上版本。
- 可调用 [DeepSeek API](https://api-docs.deepseek.com/) 的 API Key。

## 安装、构建和启动

在项目目录打开终端，运行：

```sh
npm ci
npm run build
cp .env.example .env
```

用编辑器打开项目里的 `.env`，在 `DEEPSEEK_API_KEY=` 后填入自己的密钥。默认模型是 `deepseek-flash`，可通过 `DEEPSEEK_MODEL` 修改。也可以直接在终端环境中设置这些变量，已有的环境变量优先于 `.env`。

启动本地服务，并保持终端运行：

```sh
npm start
```

服务启动后会显示本地地址 `http://127.0.0.1:8765`。如端口被占用，先关闭占用该端口的程序，再重启本地服务。

## 在 Chrome 中加载和使用

1. 在 Chrome 打开 `chrome://extensions`，开启「开发者模式」。
2. 点击「加载已解压的扩展程序」，选择项目里的 **`dist/extension`**。如果此前加载的是项目根目录的 Ollama 版本，可以从 Chrome 扩展管理页移除旧版。
3. 打开一篇英文新闻、博客或技术文档。从 Chrome 扩展菜单打开「Translate · 网页对照翻译」，点击「翻译当前页」。
4. 正文译文逐批出现在原文下方。按钮、导航等区域空间足够时原位对照，空间不足时显示中文或省略文字。鼠标悬停可查看原文和完整译文（网页已有提示时沿用它）。取消「显示中文译文」可恢复英文，取消「显示正文英文」可只看正文译文。点击「恢复网页」可移除译文。
5. 某批失败时，扩展会保留已经显示的译文。解决错误提示中的问题后，点击「重试翻译」。滚动加载新段落后，可以再次点击「翻译当前页」。

修改扩展代码后，重新执行 `npm run build`，在 Chrome 扩展管理页点击「重新加载」，并刷新待翻译的标签页。修改本地服务后重新构建并重启 `npm start`。只修改 `.env` 时，重启本地服务即可。

## 翻译网页图片（macOS）

首次启用图片识别时，安装 Apple 命令行工具（可运行 `xcode-select --install`），在项目目录运行 `npm run build:ocr`，然后重启 `npm start`。构建 Chrome 扩展仍使用 `npm run build`。

点击「翻译当前页」后，扩展也会自动识别已加载、进入视野的网页图片。滚动到后面的图片时会继续处理。发现英文的图片会出现「查看图片译文」，点开可查看识别出的英文和中文。图片像素由本机识别，DeepSeek 只接收识别出的文字。「恢复网页」会移除译文入口并停止识别后续图片。

扩展优先读取网页 `<img>` 的原图。Chrome 限制读取跨域图片时，扩展会在当前标签页截取并裁剪图片可见区域，再交给本机识别。太小的图片和 CSS 背景图会跳过。没有识别出英文时，图片上不会出现译文入口。

## 测试

```sh
npm run typecheck
npm test
```

自动测试使用替代模型响应，无需填写 API Key。浏览器测试会加载构建后的扩展，验证网页排版、重试、恢复和自动图片翻译。在 Mac 上先运行 `npm run build:ocr`，图片测试会使用真实的本机识别。首次运行要下载测试浏览器。

```sh
npx playwright-core install chromium
npm run test:browser
```

## 目录结构

| 路径 | 用途 |
| --- | --- |
| `src/extension/` | Chrome 扩展配置、弹窗、页面内容提取、译文显示与后台请求 |
| `src/server/` | 本地 HTTP 服务、DeepSeek API 请求和图片识别入口 |
| `src/ocr/` | macOS Vision 文字识别工具 |
| `src/shared/` | 段落数据结构、分批、译文校验与本地接口配置 |
| `scripts/build.mjs` | 用 esbuild 构建扩展和本地服务 |
| `tests/` | 分批和接口测试、Chromium 扩展测试 |
| `docs/` | 架构、接口与人工验收 |
| `dist/extension/` | 构建后供 Chrome 加载的目录 |
| `dist/server.js` | 构建后的本地翻译服务 |

扩展处理当前标签页已加载的可见英文。它结合网页结构和文本长度识别正文，界面文字保留原控件，跳过常见的屏幕阅读器专用标签。Chrome 内部页面、PDF、iframe、代码块和交互表单不在处理范围内。详见 [设计与验收文档](docs/design.md)。
