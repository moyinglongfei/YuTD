# Android 本地 API

Android 通过应用内 Capacitor 插件 `YuTD` 调用 Kotlin，以 Room / SQLite 和应用私有图片目录保存数据。当前已覆盖 Elysia 源码中全部 52 个 `/api` 路由。浏览器继续使用 Elysia 服务，Android 不启动 HTTP 服务，也不回退到 Web 数据源。

## 调用链

```text
页面 / useApi → Eden → native fetcher → createNativeApi → YuTDPlugin
  → LocalDatabase.access → 模块 Service → 模块 DAO / SQLite、应用私有图片目录
```

`useApi` 保持不变。`app/api/native.ts` 按路径和 HTTP 方法统一查找接口对象，支持数字 ID、图片 UUID、随机编号、查询参数、JSON 和 multipart 上传。返回值适配为标准 `Response`，继续由 Eden 和 `requestApiData` 处理；日期解析和浏览器保持一致。

`native.client.ts` 先检查桥接版本及功能列表，随后 `api.client.ts` 创建并注入 `$api`。前端需要新增原生能力时，必须先安装包含这些能力的 APK；只有前端资源更新不会增加 Kotlin 方法。旧 APK 缺少功能时明确报错，不混用本地与远程数据库。

`$native` 是原生方法代理，`$localApi` 是直接返回桥接数据的调试入口。它们不经过 Eden 的日期解析。启用本地认证后，直接调用原生方法需要在参数中携带 `authToken`；正常页面使用的 `$api` 会自动转发登录 Cookie 中的令牌。

## 接口覆盖

| 模块 | 路由数 | 功能 |
| --- | ---: | --- |
| version | 1 | 数据版本，包括按设置时区判断跨日 |
| auth | 1 | 本地密码登录 |
| preferences | 4 | 读取、局部更新、完整替换、重置 |
| style | 4 | 列表、单条读取、新建、更新 |
| phase | 5 | 阶段 CRUD、完整自然周和关联计数 |
| event | 5 | 事件 CRUD、阶段筛选、嵌套排期 |
| event-schedule | 4 | 排期列表、新建、更新、删除 |
| task / dailytask / weeklytask | 8 | 任务筛选、创建、更新、延期、日周关注与清空状态 |
| tip / dailytips | 6 | 提示 CRUD、日周和事件任务关联、每日出现匹配 |
| image | 11 | 上传、列表、元数据、原图、简化图、删除、背景绑定、轮播队列 |
| resource | 1 | 六种资源的统一搜索、排序、分页和标签计数 |
| config | 2 | 读取和更新本地配置 |

服务端的静态前端托管、OpenAPI 文档页面不属于手机端业务接口。

## Kotlin 目录与鉴权

`MainActivity.java` 注册插件并开启 edge-to-edge；`YuTDPlugin.kt` 只负责桥接参数、协程、WebView Cookie 和结果返回。模块按业务分目录：

```text
local/
  LocalDatabase.kt
  phase/          PhaseModel.kt、PhaseService.kt
  event/          EventModel.kt、EventService.kt
  eventschedule/  EventScheduleModel.kt、EventScheduleService.kt
  task/           TaskModel.kt、TaskService.kt
  tip/            TipModel.kt、TipService.kt
  preferences/    PreferencesModel.kt、PreferencesService.kt
  style/          StyleModel.kt、StyleService.kt
  version/        VersionModel.kt、VersionService.kt
  image/          ImageModel.kt、ImageService.kt
  config/         ConfigModel.kt、ConfigService.kt
  auth/           AuthModel.kt、AuthService.kt
  resource/       ResourceModel.kt、ResourceService.kt
  utils/          Json.kt、Validation.kt、Dates.kt、Crypto.kt
```

每个 Model 收纳模块类型、字段默认值、Room Entity / DAO 声明和纯数据转换；Service 承担查询、业务校验和实际初始化操作。跨模块查询通过对应 Service 完成，DAO 只在所属模块中使用。`utils` 保存通用 JSON、类型校验、日期和密码计算函数，不查询业务表。

`LocalDatabase` 统一管理数据库实例、Service 实例、默认数据初始化、读写事务、缓存版本和 API 访问鉴权。对外的原生业务调用都通过：

```kotlin
database.access(database.phases, token) {
    get(phaseId)
}
```

是否参与认证集中在 `LocalDatabase` 的 `serviceAuthentication` 清单中：

```kotlin
PhaseService::class to true,
ImageService::class to true,
AuthService::class to false,
```

`true` 表示跟随全局 `auth.enabled`：开启时必须提供有效令牌，关闭时放行；`false` 表示公开服务。新增 Service 未列入清单时默认参与认证。登录属于公开的 `AuthService`；能力查询不访问数据库，保持公开。插件不再单独决定是否鉴权。

`LocalDatabase.authorize()` 调用 `ConfigService.authentication()` 读取开关，调用 `AuthService.session()` 查询会话，然后统一判断是否放行。Service 之间的内部协作属于应用内受信任调用，不重复走外部 API 鉴权入口。

任务时间使用设置中的 IANA 时区；带偏移的 ISO 时间保留其瞬时值，无偏移的时间若落入夏令时缺口或重复区间会明确拒绝。阶段日期、日周关联使用日历日期。数据库写入与缓存版本在事务中提交，失败一起回滚；读取不会因查询而递增版本，跨日和随机轮播选取等业务例外与 Web 行为一致。

## 数据和升级

数据库位于应用私有目录的 `databases/yutd.db`。Room 当前结构版本为 2，通过 `@AutoMigration(from = 1, to = 2)` 保留已有设置和样式，结构记录保存在 `app/schemas`。按业务目录拆分没有改变表、字段、索引或数据库标识，因此无需再增加版本号。不使用清库升级。旧版样式没有时间字段，升级时为资源排序补入固定的历史基准时间。

图片存放在 `files/images`，上传时通过 256 KiB 分片进入 `cache/image-uploads`，校验完整性、格式、大小和像素后保存；失败和取消会清理临时文件。每个文件最多 20 MiB，图片最多 8000 万像素，简化图必须是 PNG。AVIF 解码能力取决于 Android 版本。图片读取通过 Capacitor 本地文件 URL 返回 Blob，不将整张文件编码后放进一次桥接响应。

配置只作用于当前设备。本地登录默认关闭；启用时需设置密码，密码使用带随机盐的 PBKDF2 保存，随机会话令牌仅存散列和有效期，公开配置不返回密码材料。登录成功时原生同步保存并刷盘 WebView Cookie，避免立即退出时丢失登录状态。令牌与 Elysia 服务端令牌独立。`system.host` / `system.port` 作为兼容配置保留，不会让手机监听端口。`enableReminder` 与目前 Web 端一样是配置开关，不代表已经调度 Android 系统通知。

## 构建和安装

使用 JDK 21 和 Android SDK 36。日期 API 通过 core library desugaring 兼容最低 Android API 24。

在仓库根目录执行：

```powershell
bun run build
```

在 `apps/web` 同步资源：

```powershell
bunx cap sync android
```

在本目录打包，或连接设备后安装：

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:installDebug
```

输出为 `app/build/outputs/apk/debug/app-debug.apk`。覆盖安装保留应用数据。

## 全面屏

前端 viewport 使用 `viewport-fit=cover`，Capacitor 自带的 `SystemBars` 处理系统栏安全区，页面通过 `--app-safe-*` 避让。状态栏和导航栏保持可见。Android WebView 140 以下自动使用原生安全区兼容布局。
