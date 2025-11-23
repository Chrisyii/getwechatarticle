# WeChat Markdown Exporter

这是一个用于将微信公众号文章导出为 Markdown 格式的 Chrome 浏览器扩展。

## 功能特点

- 一键提取微信公众号文章内容
- 自动转换为高质量的 Markdown 格式
- 保留文章中的图片和基本格式
- 支持代码块格式化

## 开发与构建

如果你想参与开发或自己构建项目，请按照以下步骤操作：

1. **克隆仓库**

   ```bash
   git clone https://github.com/Chrisyii/getwechatarticle.git
   cd getwechatarticle
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **构建项目**

   ```bash
   npm run build
   ```

   构建完成后，会在项目根目录下生成 `dist` 文件夹。

## 安装使用

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
2. 在右上角开启 **"开发者模式" (Developer mode)**。
3. 点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
4. 选择项目目录下的 `dist` 文件夹。
5. 安装完成后，打开任意微信公众号文章页面，点击插件图标即可使用。

## 技术栈

- [Vite](https://vitejs.dev/)
- [CRXJS](https://crxjs.dev/vite-plugin)
- [Turndown](https://github.com/mixmark-io/turndown) (HTML to Markdown)
- [Readability](https://github.com/mozilla/readability) (Content extraction)
