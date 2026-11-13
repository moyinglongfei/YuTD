# 页面格式规范

适用于 `apps/web/app/pages/` 下的 Vue 页面，`index.vue` 为现有示例。单文件组件依次放置 `<script setup lang="ts">`、`<template>`、`<style scoped>`。

## Script 分区顺序

每个大部分使用一行中文注释划分，分区之间空一行。同一分区内按依赖顺序声明，相关内容放在一起；没有内容的分区直接省略，不保留空注释或占位代码。

| 顺序 | 分区注释 | 内容 |
| --- | --- | --- |
| 1 | `// 导入` | 类型、组件、组合式函数与工具导入；保留 Nuxt 自动导入习惯，不重复显式导入 |
| 2 | `// 页面配置与类型` | `definePageMeta`、页面专用类型，以及需要时的 `defineProps`、`defineEmits` 等声明 |
| 3 | `// 系统变量读取` | 路由、运行配置、全局状态、系统时间等，例如 `useRoute()`、`useRuntimeConfig()`、`useSystemTime()`、`useAppPeferences()` |
| 4 | `// API 读取` | `useApi` 客户端及读写配置，按上游到下游的顺序排列；读写同一资源的配置放在一起 |
| 5 | `// 页面变量：普通变量` | 页面常量、非响应式临时状态、定时器句柄等，优先使用 `const`，需要重新赋值时使用 `let` |
| 6 | `// 页面变量：响应式数据` | `ref`、`reactive`、模板引用，以及 API 响应与共享缓存的解构、别名 |
| 7 | `// 计算属性` | `computed` 派生值，先声明基础计算，再声明依赖它的计算 |
| 8 | `// 方法` | 业务方法、事件处理、请求写入与刷新操作，先辅助方法，再使用它们的方法 |
| 9 | `// 监听` | `watch`、`watchEffect` 等响应式副作用 |
| 10 | `// 生命周期` | 挂载、更新、卸载等钩子；申请资源和清理资源的逻辑应对应 |
| 11 | `// 对外暴露` | 页面确有需要时使用 `defineExpose` 等声明 |

## 声明与依赖

- API 区负责声明客户端，页面变量区提取页面使用的数据与状态，例如 `client.data`、`client.read.loading`。设置 `watch: true` 后，首次读取和 key 变化后的读取由 `useApi` 自动触发，页面无须重复写 watch；未启用时通过方法、监听手动读取。需要强制重试时调用 `client.read.refresh()`。
- API 的动态 key 和读取回调优先从已声明的系统变量或上游请求状态取值，避免依赖后方尚未初始化的页面变量或 `computed`。例如首页通过 `useAppPeferences()` 取得全局偏好，阶段请求从 `preferences.value?.defaultPhaseId` 取 ID。
- 完整偏好由 `useAppPeferences()` 共享，只在 `app.vue` 的 `onMounted` 中调用 `initialize()` 读取。页面直接修改全局偏好字段，初始化后的深度监听自动调用 `useApi.write()` 保存；初始化赋值不会触发写入，保存响应不回填覆盖前端状态。组件无需自行请求、刷新或提交偏好；阶段详情与其加载、刷新逻辑留在页面。
- API 确实依赖页面输入状态时，将必要的状态声明提前到对应请求之前，并用简短注释说明依赖；初始化正确性优先于机械排列，不要为了顺序添加重复状态或无意义的包装函数。
- `computed` 用于派生数据；请求写入、DOM 操作等副作用放入方法、监听或生命周期。
- 监听可能立即执行，放在它所依赖的变量和方法之后。生命周期钩子在 setup 阶段同步注册，不要放进定时器或异步回调中注册。

## 生命周期内部顺序

按挂载、更新、卸载的阶段排列，每个阶段先 before、后完成钩子：

```ts
// 生命周期
onBeforeMount(() => {
  // 挂载前准备
})
onMounted(() => {
  // 挂载后初始化 DOM 或订阅
})

onBeforeUpdate(() => {
  // 更新前处理
})
onUpdated(() => {
  // 更新后处理
})

onBeforeUnmount(() => {
  // 卸载前清理
})
onUnmounted(() => {
  // 卸载后处理
})
```

以上仅展示排列方式，实际页面只保留需要的钩子。使用 KeepAlive 时，将 `onActivated`、`onDeactivated` 放在挂载阶段之后；错误捕获等其他钩子按用途就近归组。

## 格式与修改范围

使用两个空格缩进、单引号、不加分号，保持现有 ESLint 风格。分区注释用于说明职责，细节注释仅在依赖、边界条件或业务规则需要解释时添加。纯格式整理应保留请求选项、响应式行为与模板交互，不顺带加入功能或占位声明。

相关 API 行为参考 [Nuxt useAsyncData](https://nuxt.com/docs/4.x/api/composables/use-async-data) 与 [Vue 生命周期钩子](https://cn.vuejs.org/api/composition-api-lifecycle.html)；上述分区顺序为本项目约定。
