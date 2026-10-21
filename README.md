# 栖序 Qixu · 3D 风水装修设计实验室

使用 Three.js、原生 JavaScript 和 CSS 构建的浏览器端室内空间设计器，支持家具布置、采光示意、后天八卦方位与传统文化流场效果。

## 部署到 Render

使用仓库根目录的 `render.yaml` 创建 Static Site。或手动选 **New → Static Site**，Build Command 填 `echo "Static site: no build required"`，Publish Directory 填 `site`。

## 特别说明

- 风水「气场」为传统文化可视化，不是实测物理磁场。
- 房间尺寸与太阳位置需要用户校准，估算不替代建筑测绘。
- 照片仅在当前浏览器处理；请导出 JSON 备份方案。
- Three.js 通过 CDN 加载，首次使用需联网。

仓库用于保存栖序 V4 的源码、测试和持续迭代记录。