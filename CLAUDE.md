# ITS Claude 项目说明

@AGENTS.md

开始工作前必须阅读 `docs/CLAUDE_HANDOFF.md`。涉及 Coze 部署时再阅读 `docs/NEXT_STEPS_COZE.md`。

## 当前不可违背的事实

- 主仓库：`https://github.com/wangjiantao520/its.git`，默认分支 `main`。
- 生产数据库是 Supabase PostgreSQL，项目引用 `rubclqrbdsypvixvwqhk`；运行时不得重新引入 SQLite 或 `better-sqlite3`。
- Coze 环境变量名为 `DATABASE_URL`、`ADMIN_PASSWORD`、`ITS_PASSWORD`、`ITS_PROJECT_ENV=PROD`。
- 自定义变量不得以 `COZE_` 开头。
- 只使用 pnpm；禁止 npm 和 yarn。
- 不得把密码、数据库连接串或 API Key 写入源码、文档、提交、聊天或日志。
- 不要修改或提交根目录未跟踪的 `trae-agent/`。

## 工作方式

1. 先运行 `git status --short --branch`，确认当前分支与用户改动。
2. 先复现和定位问题，再做最小范围修改；保留现有路由、数据和 UI 兼容性。
3. TypeScript 保持严格类型，不得使用隐式 `any` 或 `as any`。
4. 修改完成至少运行 `pnpm validate` 和相关测试；交付前运行 `pnpm test` 与 `pnpm build`。
5. 没有 `TEST_DATABASE_URL` 时，明确说明 PostgreSQL 集成测试被跳过，不能声称完整通过。
6. 未看到命令结果、HTTP 响应或页面实测证据时，不得声称部署或功能已经成功。

## DeepSeek-v4-flash 适配

- 每次只处理一个明确目标，优先读取本文件指向的资料，不做全仓库无差别扫描。
- 工具调用保持短小；修改前列出假设，修改后给出命令、退出码和未验证项。
- 遇到数据库写操作、迁移、删除、强制 Git 操作或线上部署付费确认时先停下请求用户确认。
