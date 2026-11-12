# 数据结构

本页介绍两端共用的业务概念。Web 的完整数据库定义在 `apps/server/prisma/schema.prisma`；Android 的表、DAO 和字段转换按模块放在 `apps/web/android/app/src/main/java/com/yutd/app/local/` 的 `*Model.kt` 中。

两端接口表达相同的业务数据，底层表结构不完全相同。不要直接交换两端的 SQLite 文件。

## 核心关系

```text
Phase 阶段
├─ Event 事件
│  └─ EventSchedule 事件排期
└─ Task 任务 ── 可选关联一个 Event
   ├─ TaskReminder 提醒时间
   └─ TaskTag 标签

Tip 提示 ── 可关联多个 Phase / Event / Task / Date / Week
Preferences 偏好 ── 默认 Phase、当前 Style
Image 图片 ── ImageBackground 背景绑定
```

例如，一个学期是 `Phase`，「高等数学」是 `Event`，「第 1～16 周的周一 08:00～09:40」是 `EventSchedule`；「周五前完成作业」则是可关联这门课的 `Task`。

## 阶段、事件与排期

| 数据 | 主要字段 | 用途 |
| --- | --- | --- |
| `Phase` | `id`、`name`、`startDate`、`endDate` | 划定阶段范围，作为事件和任务的归属 |
| `Event` | `id`、`name`、`phaseId`、`organizer`、`location`、`color` | 保存事件基本信息及默认组织者、地点 |
| `EventSchedule` | `id`、`eventId`、`weekday`、`startTime`、`endTime`、`weeks` | 表示事件在指定周、星期与时间段的排期 |

阶段按完整自然周组织，周一作为一周起点。排期的 `weeks` 是阶段内周次列表；`weekday` 使用 1～7 表示周一到周日，时间采用 `HH:mm`。单次排期可以覆盖事件的默认组织者与地点。

删除阶段时，仍关联事件或任务会阻止删除；删除事件会连带删除它的排期，任务上的可选事件关联则被清空。

## 任务

| 字段或子数据 | 说明 |
| --- | --- |
| `title`、`description` | 标题与可选描述 |
| `phaseId`、`eventId` | 必须归属一个阶段，可以关联一个事件 |
| `status` | `TODO`、`DOING`、`DONE`、`CANCELLED` |
| `completed`、`completedAt` | `completed` 仅在 `DONE` 时为真；完成或放弃时记录 `completedAt`，重新打开时清空 |
| `priority` | 优先级 |
| `plannedDate`、`dueDate` | 计划时间与截止时间 |
| `estimatedTime`、`actualTime` | 预计与实际耗时 |
| `TaskReminder` | 任务的提醒时间；同一任务的相同时间不重复 |
| `TaskTag` | 任务标签；同一任务的相同标签不重复 |

任务的创建与更新时间分别为 `createdAt`、`updatedAt`。API 中的提醒输入使用 `reminderTimes`，具体请求字段以模块 Model 为准；数据库实体与接口输入不必逐字段同名。

## 提示与日历状态

`Tip` 保存 `content`、`createdAt`、`updatedAt`，并可同时关联多个阶段、事件、任务、日期和周。提示的 `updatedAt` 只在内容变化时更新。

`Date` 与 `Week` 用来保存某一天或某一周的提示关联、任务清空状态等数据，并不要求提前为所有日期生成记录。

| 字段 | 说明 |
| --- | --- |
| `id` | `phaseId:YYYY-MM-DD`，不限定阶段时使用 `all:YYYY-MM-DD`；周记录使用周一日期 |
| `date` | 日历日期，格式为 `YYYY-MM-DD` |
| `phaseId` | 可为空，空值表示共享的日或周 |
| `taskState` | `0` 表示显示任务，`1` 表示已清空 |
| `weekNumber` | 周记录所属阶段的周次；共享周可为空 |

## 样式、偏好与图片

| 数据 | 内容 |
| --- | --- |
| `Style` | 样式名称、显示模式、背景色、文字颜色、字体等 |
| `Preferences` | 默认语言、默认阶段、当前样式、侧栏宽度、日程缩放与布局、时区设置等 |
| `Image` | 字符串 ID、名称、格式、尺寸、大小、创建时间、随机轮播状态等元数据 |
| `ImageBackground` | 通过 `backgroundKey` 绑定图片，并保存裁剪位置 `position` |

图片二进制文件保存在文件目录中，数据库保存元数据与关联。业务实体的多数 ID 是自增数字，图片 ID 是字符串；独立数据库生成的相同数字 ID 不代表同一条记录。

## Web 与 Android 的存储差别

| 业务数据 | Web / Prisma | Android / Room |
| --- | --- | --- |
| 日、周状态 | 分为 `Date`、`Week` 两个模型 | 合并为 `calendar` 表，通过 `weekly` 区分，主键为 `id + weekly` |
| 提示的多种关联 | Prisma 多对多关系及其关联表 | 统一存入 `tip_links(tipId, kind, targetId)`，由 Service 校验目标 |
| 时间和列表字段 | Prisma `DateTime`、`Json` 等类型 | 按字段使用字符串、JSON 文本等表示，再转换为接口数据 |
| 数据版本 | `ServerInfo.version` | `data_version.version` |

阶段起止日期在原生表内按日历日期保存，输出时转换成与 Web 兼容的 ISO 格式。`Date.date` / `Week.date` 表示日历日期，不做时区换算；任务时刻等数据需要结合偏好中的时区处理。

接口传输中的日期是 JSON 字符串；正常页面通过 Eden 获得解析后的日期值。直接调用原生桥接得到的仍是字符串，使用时要分清调用层次。

## 配置、认证与版本

Web 的系统配置保存在 YAML 中，通过服务端认证逻辑签发 JWT。Android 将本地配置放在 `local_config`，将会话令牌的散列与有效期放在 `local_sessions`，通过 `LocalDatabase` 统一检查访问权限。两端的令牌不能互用。

`/api/version` 返回数据版本，前端据此判断读取缓存是否失效。它与 Room 的数据库结构版本是两回事：前者随业务变化，后者用于表结构迁移，Android 当前结构版本为 `2`。

目前的数据版本还参与跨日刷新等缓存逻辑，不能直接当作多端同步协议。`remote-local` 同步仍处于设计阶段。
