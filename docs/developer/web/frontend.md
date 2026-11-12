# Web 前端

源码位于 `apps/web/`，使用 Vue 3、Nuxt 和 TypeScript，配合 Tailwind CSS 与 GSAP 构建界面。

当前配置为 `ssr: false`，通过 `nuxt generate` 生成静态应用。Vue 仍在浏览器中运行，页面交互和响应式更新由前端完成；业务数据来自 Elysia API。

## 文件结构

```text
apps/web/
├─ app/
│  ├─ app.vue             应用根组件
│  ├─ app.config.ts       应用配置
│  ├─ pages/              页面与路由
│  ├─ components/         展示组件、编辑表单和通用界面
│  ├─ composables/        请求、缓存、字体、系统状态等组合式函数
│  ├─ api/                Web 与原生 API 适配
│  ├─ plugins/            Nuxt 插件与全局注入
│  ├─ utils/              请求、日期、排期、图片处理等工具
│  └─ assets/css/         全局样式
├─ public/                原样复制的静态资源
├─ android/               Capacitor Android 工程
├─ nuxt.config.ts         Nuxt、静态输出、开发代理等配置
├─ capacitor.config.ts    Capacitor 应用与静态资源配置
└─ package.json           前端依赖和脚本
```

`pages/` 中的 `index.vue`、`schedule.vue`、`edit.vue`、`resources.vue`、`setting.vue`、`login.vue` 分别承担首页、日程、编辑、资源、设置与登录功能。

`components/` 主要按用途划分：`common/` 为通用界面，`preview/` 为日程、任务、提示等展示，`edit/` 为编辑表单，`image/` 为图片上传、裁剪和背景设置。

## 数据请求入口

```text
页面 / 组件
  → composables/useApi/
  → Nuxt 注入的 $api
  → Eden Treaty
  → HTTP /api/...
  → Elysia
```

| 文件 | 职责 |
| --- | --- |
| `app/plugins/api.client.ts` | 创建并注入 `$api`，提供认证令牌，处理启动时的认证检查 |
| `app/utils/api.ts` | 创建统一 API 客户端，选择请求传输方式，解包响应与错误 |
| `app/api/web.ts` | 创建 Eden Treaty 客户端，配置认证头与图片响应 |
| `app/composables/useApi/index.ts` | 向页面提供统一的读写入口与响应式数据 |
| `app/composables/useApi/read.ts` | 比较数据版本，读取或复用对应 key 的缓存 |
| `app/composables/useApi/write.ts` | 执行写入请求并统一处理结果 |

Eden 从后端导出的 `App` 类型推导请求路径、输入与返回值。这里的后端导入是类型导入，不会把 Bun / Elysia 服务启动代码打包进浏览器。

## 缓存与共享代码

`useApi` 使用 Nuxt `useState` 保存当前运行期间的读取缓存，通过 `/api/version` 判断是否需要重读。它不等同于把完整业务数据库持久化在浏览器里。

`composables/useIndexedDB/` 提供独立的 IndexedDB 缓存工具，目前不代表已完成 Web 离线数据库或远程同步。`useApiMode()` 中的 `local`、`remote`、`remote-local` 也仍是预留模式，没有完整的模式切换实现。

仓库根目录的 `shared/` 保存资源、图片、时间、任务关注范围等共享 TypeScript 定义与工具；页面相关工具留在 `app/utils/`。

## 开发与构建

在仓库根目录执行：

```sh
bun run web
bun --filter @yutd/web typecheck
bun --filter @yutd/web lint
bun --filter @yutd/web build
```

开发服务器默认使用 `4017` 端口，`/api` 请求按 `nuxt.config.ts` 的代理配置发送至 Elysia，后端可另用 `bun run server` 启动。静态构建产物输出到 `apps/server/web/`，供服务器托管，也供 Capacitor 同步。

相关技术：[Vue](https://vuejs.org/guide/introduction.html)、[Nuxt](https://nuxt.com/docs/4.x/getting-started/introduction)、[Eden Treaty](https://elysiajs.com/eden/treaty/overview)。
