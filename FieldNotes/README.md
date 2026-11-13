# 栈间笔记 · Field Notes

一个借鉴终端导航和文章索引风格的个人技术博客前端。当前用示例文章和介绍展示界面。

## 本地运行

在本目录启动静态服务器：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

打开 http://127.0.0.1:8000 。按 S 打开搜索，按 Esc 关闭。首页分类只筛选文章索引，搜索包含精选文章。

## 桌宠音效

点击首页桌宠会跳一下并播放音效。播放时再次点击会停止。音频已存放在 `assets/pet-click.m4a`，预览时直接使用。要从其他视频重新提取音轨，可在 macOS 上用 Swift 运行：

```sh
swift scripts/extract-audio.swift "/path/to/video.mp4" "assets/new-pet-click.m4a"
```

脚本要求输出为 `.m4a`，并保留已有文件。提取后可以替换现有音效文件。

## 文件

- `index.html` 页面框架和搜索窗口
- `app.js` 页面切换、文章渲染、分类和搜索
- `data.js` 示例文章数据
- `styles.css` 布局、字体和移动端样式
- `assets/` 站点图片和音效
- `scripts/extract-audio.swift` 从视频导出音频

文章通过地址里的片段导航，可以直接打开或分享文章地址。以后接入后端时，可以先替换本地数据来源，再根据接口增加加载和错误状态。
