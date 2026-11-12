# 项目概览

YuTD 是结合课程表与待办事项的日程规划应用。它以「阶段」组织一段时间内的事件、排期和任务，用提示补充关联信息，并提供样式、图片背景等界面设置。

## 当前架构

项目共用一套 Vue / Nuxt 前端，按运行平台连接不同的数据实现：

| 运行平台 | 界面 | 业务处理 | 持久化 |
| --- | --- | --- | --- |
| Web 浏览器 | Vue / Nuxt 静态应用 | Bun / Elysia，通过 HTTP 访问 | Prisma / SQLite，服务器图片目录 |
| Android | Capacitor WebView 加载同一套静态应用 | Kotlin，通过 Capacitor 插件调用 | Room / SQLite，应用私有图片目录 |

Android 的「本地后端」指应用内部的 Kotlin 服务层。它与前端运行在同一个应用中，不启动 Elysia，也不监听 HTTP 端口。

两端尽量提供一致的业务接口，但数据库文件与登录令牌各自独立。目前 `remote`、`remote-local` 只有模式预留，远程与本地之间的自动同步尚未实现。

## 仓库目录

以下路径均以仓库根目录为起点。

```text
YuTD/
├─ apps/
│  ├─ web/             Nuxt 前端源码与 Capacitor Android 工程
│  └─ server/          Elysia 后端、Prisma 模型、静态前端构建产物
├─ shared/             Web 前后端共用的 TypeScript 类型与工具
├─ docs/               VitePress 文档
├─ config.example.yaml 配置模板
└─ package.json        Bun workspace 与根目录脚本
```

`shared/` 是 TypeScript 共享代码，不能直接作为 Kotlin 模块使用。Android 在原生层实现相应的校验和业务规则。

## 从哪里读起

先看 [数据结构](./developer/data-structure.md)，了解阶段、事件、任务之间的关系；然后根据负责的部分阅读：

- [Web 前端](./developer/web/frontend.md)：页面、组件、请求封装与缓存。
- [Web 后端](./developer/web/backend.md)：路由、业务服务与 Prisma 数据库。
- [Android 前端](./developer/android/frontend.md)：静态资源如何进入 APK，以及请求如何转入原生。
- [Android 本地后端](./developer/android/backend.md)：Capacitor 插件、Kotlin 服务、Room 与鉴权。

文档目前以技术与文件结构介绍为主，部署教程和逐接口说明后续补充。
