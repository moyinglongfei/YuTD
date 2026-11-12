# Web 后端

源码位于 `apps/server/`，使用 Bun 运行 TypeScript，通过 Elysia 声明 HTTP 路由和输入校验，通过 Prisma 访问 SQLite。

Bun 是运行时，Elysia 负责接口，Prisma 负责数据库访问，SQLite 才是实际保存业务记录的数据库。生产运行时，Elysia 还会托管 Nuxt 生成的静态前端。

## 文件结构

```text
apps/server/
├─ src/
│  ├─ index.ts         服务入口、插件、认证与业务路由注册
│  ├─ modules/         按业务划分的路由、模型和服务
│  └─ lib/             数据库、认证、配置、版本、HTTP 与静态托管
├─ prisma/
│  └─ schema.prisma    数据库模型与关系
├─ generated/prisma/   自动生成的 Prisma 客户端与初始化 SQL
├─ web/                Nuxt 静态构建产物
├─ uploads/            运行时图片文件
├─ prisma.config.ts    Prisma 工具配置
├─ build.ts            Bun 可执行文件打包
└─ package.json        后端依赖和脚本
```

`generated/prisma/`、`web/` 是生成目录，通常应修改源文件后重新生成。默认 SQLite 文件为 `apps/server/dev.db`；运行配置来自仓库根目录 `config.yaml`，缺少时从 `config.example.yaml` 初始化。二进制发行版将运行数据放在可执行文件旁。

## 业务模块

`src/modules/` 包含 `phase`、`event`、`eventSchedule`、`task`、`tip`、`preferences`、`style`、`image`、`resource`、`config`。

以 `phase/` 为例：

```text
phase/
├─ index.ts     路由路径、HTTP 方法、输入与响应声明
├─ model.ts     接口模型、校验规则与类型
└─ service.ts   查询、写入、关联处理与业务规则
```

Prisma 表结构集中在 `schema.prisma`，模块的 `model.ts` 主要描述 API 数据，两者承担不同职责。`resource` 提供多类资源的统一查询，不代表额外的一张资源表。

## 一次请求的经过

```text
HTTP 请求
  → src/index.ts 注册的插件与认证
  → modules/<模块>/index.ts 路由及输入校验
  → service.ts 业务处理
  → Prisma Client
  → SQLite
```

普通 JSON 响应由公共 HTTP 逻辑统一处理；图片等接口可以返回文件响应。前端通过 Eden 与统一请求工具使用这些结果。

## 公共基础功能

| 文件 | 职责 |
| --- | --- |
| `lib/prisma.ts` | 创建 Prisma 客户端、连接数据库并处理初始化 |
| `lib/database.ts` | 解析 SQLite 地址与数据库文件位置 |
| `lib/auth.ts` | 登录路由、JWT 与访问认证 |
| `lib/config.ts` | 读取、校验、更新 YAML 配置 |
| `lib/version.ts` | 读取和更新数据版本，处理跨日刷新 |
| `lib/http.ts` | 公共响应、错误、日志与成功写入后的版本更新 |
| `lib/frontend.ts` | 生产环境静态资源与前端路由回退 |
| `lib/paths.ts` | 区分源码运行和二进制运行的文件位置 |

业务路由受全局认证配置控制，登录入口公开。Web 认证与 Android 本地会话是独立实现。

## 开发与检查

在仓库根目录执行：

```sh
bun run server
bun --filter @yutd/server typecheck
bun --filter @yutd/server prisma:generate
```

`prisma:generate` 会生成客户端与初始化 SQL，不应将它当作已有数据库的通用迁移命令。修改已有表结构时，需要另行考虑数据迁移。

相关技术：[Bun](https://bun.com/docs)、[Elysia](https://elysiajs.com/)、[Prisma](https://www.prisma.io/docs)。
