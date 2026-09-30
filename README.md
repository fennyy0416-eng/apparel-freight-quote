# 运费助手 · Apparel Freight Quote

美国服装海运报价网页原型，包含电商及传统物流两条报价流程。

## 本地运行

无需安装依赖，在仓库根目录运行：

```sh
python3 -m http.server 8000 --directory dist
```

打开 http://localhost:8000 。请通过 HTTP 服务运行，以加载 tariffs.json。

## 文件

- dist/index.html、style.css、app.js：界面和交互
- dist/engine.js、quote-rules.js：报价计算与规则
- dist/tax-engine.js、tariffs.js、tariffs.json：税费逻辑和税则数据快照

## 当前范围

此版本为报价演示原型。运价与税则数据需要业务审核和更新，不代表实时承运商报价或最终报关税额。Ocean Tracking、卡车报价、正式订舱及账号后端尚未接入。浏览器本地保存的数据不会随源代码备份。

本次从 Sites 源码提交 cf3e446ebb951da29af5852f388fda5297ad7df0 导出。GitHub 保存不会自动同步后续 Sites 修改。
