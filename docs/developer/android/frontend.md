# Android 前端

Android 复用 `apps/web/` 的 Vue / Nuxt 页面。Capacitor 将生成的 HTML、CSS、JavaScript 等资源装入 Android 工程，在 WebView 中运行。

这不是将 Vue 组件转换成 Android 原生控件：Vue 运行时、页面逻辑与样式仍在 WebView 中执行，数据操作通过桥接交给 Kotlin。

## 相关文件

```text
apps/web/
├─ app/                         与 Web 共用的界面源码
│  ├─ plugins/native.client.ts   注册原生代理、检查平台与插件能力
│  ├─ plugins/api.client.ts      创建统一 $api 并选择传输方式
│  ├─ api/native.ts              原生方法类型、接口对象、请求适配
│  ├─ api/web.ts                 共用的 Eden 客户端
│  └─ utils/api.ts               API 创建与响应解包
├─ capacitor.config.ts          应用 ID、webDir、系统栏配置
└─ android/
   └─ app/src/main/assets/
      └─ public/                 同步进入 Android 工程的前端产物
```

`capacitor.config.ts` 的 `webDir` 指向 `../server/web`，也就是 Nuxt 的静态输出目录。`assets/public/` 由同步命令更新，不作为前端源码编辑。

## 同一个 $api 如何使用本地数据

```text
页面 / useApi
  → $api / Eden
  → 原生 fetcher 按路径与方法匹配接口
  → createNativeApi
  → Capacitor 的 YuTD 插件
  → Kotlin
```

`native.client.ts` 使用 `registerPlugin('YuTD')` 创建 JavaScript 代理，在 Android 上读取原生能力；`api.client.ts` 随后创建 `$api`，选择原生传输方式。浏览器则继续使用 HTTP。

Android 仍然保留 Eden 这一层。自定义 fetcher 将类似 `/api/preferences` 的路径映射为原生方法，再把结果适配为 `Response` 供 Eden 处理，因此页面的 `useApi` 可以共用。

`$native` 是原生方法代理，`$localApi` 是可直接调用的接口对象；正常页面优先使用 `$api`，保持日期解析、错误处理和认证传递的一致性。

## 更新前端的流程

先在仓库根目录构建：

```sh
bun --filter @yutd/web build
```

再进入 `apps/web/` 同步：

```sh
bunx cap sync android
```

最后通过 Android Studio 的 Run 或 Gradle 重新构建并覆盖安装 APK。设备需要处于 ADB 在线状态；安装失败时，手机上的旧包不会自动更新。

仅修改 Vue 源码不会改变已安装 APK 的资源。当前没有配置前端在线热更新；新增 Kotlin 方法也必须安装包含对应原生代码的新 APK。

## 安全区与运行状态

前端通过 `viewport-fit=cover`、Capacitor `SystemBars` 和 `--app-safe-*` CSS 变量处理状态栏、导航栏与安全区，主要涉及 `nuxt.config.ts`、`capacitor.config.ts`、`app.vue` 和全局样式。

Nuxt `useState` 的内存状态不会因为打成 APK 就自动持久化。应用进程结束后，需要重新初始化；业务数据由 Room 保存，其他持久化缓存需要显式使用相应存储工具。

相关技术：[Capacitor](https://capacitorjs.com/docs)、[Android 自定义代码](https://capacitorjs.com/docs/android/custom-code)。
