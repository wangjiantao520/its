# 项目上下文

## 项目概述

宁德移动 ICT 项目工程报价及维保业务管理系统。提供工程勘察报价、设备台账、维保报价、AI 智能助手、报价分享等功能。面向工程报价人员的专业 Web 工具。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **数据库**: Supabase PostgreSQL（生产运行使用 `postgres` 客户端；SQLite 仅用于一次性历史数据迁移工具）
- **运行时入口**: `src/server.ts`（自定义 HTTP server 包装 Next.js）
- **包管理器**: pnpm

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
│   ├── build.sh            # 构建脚本
│   ├── dev.sh              # 开发环境启动脚本
│   ├── prepare.sh          # 预处理脚本
│   └── start.sh            # 生产环境启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 工具库
│   │   └── utils.ts        # 通用工具函数 (cn)
│   └── server.ts           # 自定义服务端入口
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 关键入口 / 核心模块

### 页面路由
- `/` — 首页（登录入口）
- `/login` — 登录页
- `/dashboard` — 仪表盘
- `/engineering` — 工程勘察管理
- `/quotes` — 报价管理列表
- `/quotes/[id]` — 报价详情/编辑
- `/maintenance` — 维保报价
- `/device-import` — 设备导入
- `/survey-upload` — 勘察上传
- `/database` — 数据库管理
- `/assistant` — AI 智能助手
- `/history` — 历史记录
- `/reports` — 报告
- `/share/[token]` — 报价分享页
- `/admin/*` — 管理后台（dashboard、users、members、ai-config、agents）
- `/settings/*` — 系统设置

### API 路由（55 个）
- `/api/auth/*` — 认证
- `/api/quotations/*` — 报价 CRUD
- `/api/engineering-quotes/*` — 工程报价
- `/api/maintenance-quotes` — 维保报价
- `/api/ai-parse-engineering` — AI 解析工程
- `/api/ai-match-devices` — AI 匹配设备
- `/api/agent-sessions/*` — AI Agent 会话
- `/api/dashboard/*` — 仪表盘数据
- `/api/device-params/*` — 设备参数
- `/api/audit-logs` — 审计日志

### 核心业务逻辑
- `src/lib/database/client.ts` — PostgreSQL 数据库连接
- `src/lib/database/` — Schema 与迁移
- `src/lib/auth.ts` / `api-auth*.ts` — 认证与鉴权
- `src/lib/ai-*.ts` — AI 能力集成
- `src/lib/quote-*.ts` — 报价计算逻辑
- `src/lib/maintenance-*.ts` — 维保计算

## 运行与预览

- **预览脚本**：`scripts/dev.sh`（从 `.preview` 读端口，绑定 `0.0.0.0`，tsx watch 热更新）
- **构建脚本**：`scripts/build.sh`（pnpm install → next build → tsup 打包 server.ts）
- **生产启动**：`scripts/start.sh`（node dist/server.js，端口 5000）
- **`.preview`**：`expose_port = 5000`，已加入 `.gitignore`
- **`.coze`**：`project_type = "web"`，`preview_enable = "enabled"`

## 用户偏好与长期约束

- 包管理器仅允许 pnpm
- 代码使用 TypeScript strict 模式
- UI 使用 shadcn/ui 组件库
- 设计稿参见 `DESIGN.md`（深蓝主色 #1e40af，专业商务风格）

## 常见问题和预防

- Next.js 启动时可能出现 `url.parse()` 弃用警告（来自 server.ts），不影响功能
- 多 lockfile 警告（pnpm-workspace.yaml）：项目使用 workspace 模式，可忽略
- 生产运行不得重新引入 `better-sqlite3`；Coze 通过 `DATABASE_URL` 连接 Supabase PostgreSQL
- Coze 自定义环境变量使用 `ITS_PROJECT_ENV=PROD`，禁止使用平台保留的 `COZE_` 前缀
- 环境变量通过 `.env` 文件管理（DB 配置、认证密码等），参见 `.env.example`
