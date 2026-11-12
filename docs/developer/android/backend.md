# Android 本地后端

Android 使用 Kotlin 实现本地业务，通过 Capacitor 接收前端调用，通过 Room 访问 SQLite。这里的「后端」是应用内服务层，没有单独的服务器进程，也没有使用 Ktor。

Room 提供表声明、DAO 与数据库迁移，Kotlin 协程负责异步执行。前端收到的是 Promise 结果，不需要直接操作 SQLite。

## Android 工程结构

```text
apps/web/android/
├─ app/
│  ├─ src/main/
│  │  ├─ AndroidManifest.xml     应用入口、权限与 Android 配置
│  │  ├─ java/com/yutd/app/      Java / Kotlin 源码
│  │  ├─ res/                   图标、启动画面、主题等原生资源
│  │  └─ assets/public/          同步后的静态前端
│  ├─ schemas/                  Room 导出的数据库结构记录
│  ├─ build.gradle              应用依赖、编译与 Room / Kotlin 配置
│  └─ capacitor.build.gradle    Capacitor 生成的依赖配置
├─ build.gradle                 工程级构建配置
├─ settings.gradle              子模块与插件工程声明
├─ variables.gradle             Android SDK 等公共版本配置
├─ gradle/wrapper/               Gradle Wrapper 版本与启动依赖
└─ gradlew / gradlew.bat         构建入口
```

`java/` 只是源码目录名，其中可以同时放 `.java` 与 `.kt`。业务源码集中在 `java/com/yutd/app/`：

```text
com/yutd/app/
├─ MainActivity.java      Android 界面入口、注册 YuTD 插件、全面屏设置
├─ YuTDPlugin.kt          接收桥接参数、启动协程、返回结果
└─ local/
   ├─ LocalDatabase.kt    数据库、Service、事务、初始化、版本与统一鉴权
   ├─ phase/             阶段
   ├─ event/             事件
   ├─ eventschedule/     事件排期
   ├─ task/              任务、提醒、标签与日周状态
   ├─ tip/               提示及关联
   ├─ preferences/       偏好
   ├─ style/             样式
   ├─ version/           数据版本
   ├─ image/             图片与背景绑定
   ├─ config/            本地配置
   ├─ auth/              登录与会话
   ├─ resource/          统一资源查询
   └─ utils/             JSON、校验、日期与密码计算工具
```

## Model、Service 与数据库

每个业务目录通常由两个文件组成，例如 `phase/PhaseModel.kt` 与 `phase/PhaseService.kt`。

| 部分 | 职责 |
| --- | --- |
| `*Model.kt` | 模块类型、默认值、Room Entity / DAO 声明、纯数据转换 |
| `*Service.kt` | 查询、业务校验、实际初始化与写入操作 |
| `LocalDatabase.kt` | 注册实体与 DAO，统一管理 Service、默认数据、事务和认证 |
| `utils/` | 可复用的基础函数，不查询业务表 |

Entity 描述一张表，DAO 声明 SQL 查询和插入更新方法，Room 在编译时生成实际实现。Service 使用自己的 DAO；需要其他模块的数据时，调用对应 Service。

与 Elysia 模块相比，Kotlin 模块没有逐个 HTTP 路由文件：外部入口集中在 `YuTDPlugin.kt`，表结构则随业务放在各自的 Model 中。

## 一次读取的经过

以读取偏好为例：

```text
前端 api.api.preferences.get()
  → 原生请求适配
  → YuTDPlugin.getPreferences(call)
  → execute(call, database.preferences)
  → LocalDatabase.access(service, token)
  → PreferencesService.get()
  → PreferencesDao 查询
  → SQLite
```

查询完成后，记录通过 `toJS()` 转为前端可用的数据，`call.resolve()` 让 JavaScript Promise 完成；异常通过统一桥接错误处理返回。

`LocalDatabase.read()`、`write()` 使用 Room 事务。写入操作和数据版本递增一起提交，失败时一起回滚。

## 统一鉴权

原生业务入口通过 `LocalDatabase.access()` 检查访问权限。哪些 Service 参与认证集中在 `serviceAuthentication` 中：普通业务服务跟随本地认证开关，`AuthService` 公开以允许登录，未列出的新服务默认参与认证。

开启认证后，`LocalDatabase` 向 `ConfigService` 读取开关，向 `AuthService` 查询会话，再判断令牌与有效期。Service 之间的内部调用属于受信任协作，不重复走外部访问入口。

本地密码按带盐散列保存，会话仅保存令牌散列与有效期。它与 Elysia 的 JWT 独立；认证限制的是本地 API 的访问，不表示 SQLite 文件已加密。

## 数据文件与结构升级

数据库位于应用私有目录 `databases/yutd.db`，原图和简化图位于 `files/images/`，上传临时文件位于 `cache/image-uploads/`。覆盖安装通常保留这些数据，清除应用数据或卸载会移除本地数据。

Room 当前结构版本为 `2`，已有 `1 → 2` 自动迁移，结构记录保存在 `app/schemas/`。增加表或修改字段需要考虑迁移；仅移动 Kotlin 源文件位置不需要增加数据库版本。

本地配置中的 `system.host` / `system.port` 为兼容字段，不会开启监听端口；提醒功能开关也不代表已实现 Android 系统通知调度。

## 构建

当前工程使用 JDK 21，编译与目标 SDK 为 36，最低支持 Android API 24。在 `apps/web/android/` 执行：

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:installDebug
```

前者生成 `app/build/outputs/apk/debug/app-debug.apk`，后者将调试包安装到在线设备。前端源码有变化时，应先完成 [前端构建与同步](./frontend.md#更新前端的流程)。

## Kotlin 能否直接迁移 iOS

Kotlin 可以通过 Kotlin Multiplatform 将共享代码编译到 iOS，但当前工程是 Android 工程，尚未拆分共享模块。Kotlin 官方也明确区分公共代码与平台代码：`java.*` 等 JVM API 不能直接放进跨平台公共代码。[Kotlin 官方说明](https://kotlinlang.org/docs/multiplatform/multiplatform-discover-project.html)。

当前的 Capacitor Android 插件、`Context`、WebView Cookie、图片解码、文件和部分日期与加密操作均依赖 Android / JVM，需要替换或适配。Room 支持 KMP，但也需要按多平台方式配置数据库与驱动，并不意味着现有数据库初始化代码原样可用。[Room KMP 文档](https://developer.android.com/kotlin/multiplatform/room)。

以后接入 iOS，可以继续复用 Nuxt 界面和 JavaScript 接口约定；原生层可选择 Swift 实现同名 Capacitor 插件，或用 Swift 桥接共享的 Kotlin 业务模块。Capacitor 的 iOS 插件入口使用 Swift / Objective-C，当前的 Android 插件类不能直接注册到 iOS。[Capacitor iOS 插件文档](https://capacitorjs.com/docs/plugins/ios)。

相关技术：[Room](https://developer.android.com/training/data-storage/room)、[Capacitor Android 插件](https://capacitorjs.com/docs/plugins/android)、[Kotlin 协程](https://kotlinlang.org/docs/coroutines-overview.html)。
