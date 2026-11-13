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

页面的 script 分区顺序、变量声明与生命周期排列见[页面格式规范](./page-format)。

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
| `app/composables/useApi/index.ts` | 向页面提供统一的读写入口与响应式数据，创建每个实例独立的读写计数 |
| `app/composables/useApi/read.ts` | 执行读取，增减传入的 pending，管理版本缓存与强制刷新 |
| `app/composables/useApi/write.ts` | 执行写入，增减传入的 pending，处理请求与错误 |

Eden 从后端导出的 `App` 类型推导请求路径、输入与返回值。这里的后端导入是类型导入，不会把 Bun / Elysia 服务启动代码打包进浏览器。

## 缓存与共享代码

`useApi` 使用 Nuxt `useState` 保存当前运行期间的读取缓存，通过 `/api/version` 判断是否需要重读。它不等同于把完整业务数据库持久化在浏览器里。

保持 `client.read()`、`client.write(value)` 的调用方式，读写各自提供响应式状态：

```ts
client.read.loading.value // 是否仍有读取或刷新在进行
client.write.saving.value // 是否仍有写入在进行
await client.read.refresh() // 照常获取版本，跳过缓存命中，重新读取并保存数据与版本
```

loading、saving 属于当前 `useApi` 实例，成功或失败后都会复位；并发时等待该类请求全部结束才变为 `false`。强制刷新仍保存本次取得的版本，下次普通读取在版本一致时复用刷新后的缓存。

需要首次读取和 key 变化时自动重读，可设置 `watch: true`：

```ts
const client = useApi({
  key: () => `phase:${preferences.value?.defaultPhaseId ?? 'none'}`,
  read: async (api) => {
    const id = preferences.value?.defaultPhaseId
    return id == null ? null : api.api.phase({ id }).get()
  },
  watch: true
})
```

监听封装在 `useApi` 内部，页面只使用 `client.data` 与 `client.read.loading`，无须再写 watch。手动 `read()`、`read.refresh()` 仍可调用；自动读取失败由 `useApi` 统一上报。未设置 `watch` 时保持手动读取行为，与已有 `useAsyncData` 调用兼容；仅配置写入方法时不启动自动读取。

完整偏好通过 `useAppPeferences()` 获取：

```ts
const { preferences, loading, saving, initialize } = useAppPeferences()

onMounted(() => {
  void initialize()
})
```

初始化只在 `app.vue` 挂载后调用（登录页跳过），通过 `useApi.read()` 将完整偏好存入全局 `preferences`。同一应用的调用共用一份客户端与监听，loading、saving 直接引用 `useApi` 的 `read.loading` 和 `write.saving`，不另行维护计数。初始化读取不会触发保存；之后直接修改 `preferences.value` 中的字段，深度监听会通过 `useApi.write()` 自动保存。各组件无需单独读取或写入偏好。

前端修改立即生效，保存按修改顺序执行，后端响应不回填覆盖前端新值；失败由 `useApi` 上报并保留前端状态，后续修改仍可继续保存。阶段详情的请求、加载状态和刷新由页面负责。

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
