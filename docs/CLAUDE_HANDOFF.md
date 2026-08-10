# ITS 系统最终交接文档（Claude Desktop）

更新时间：2026-08-10

> 接手后先阅读项目根目录 `CLAUDE.md` 和 `AGENTS.md`，再阅读本文。先核对状态，不要立即改代码，不要输出任何密钥。

## 一、项目定位

宁德移动 ICT 工程报价及维保业务管理系统，主要包含：

- 工程勘察与工程报价
- 维保报价
- 设备与报价参数管理
- 报价版本、审核、复制、分享与历史记录
- 管理员、成员、登录会话与角色权限
- 首页看板与统计报表
- AI 助手、Agent 会话、模型配置与日志

## 二、代码与环境基线

| 项目 | 当前值 |
| --- | --- |
| 本地目录 | `/Users/wangjiantao/Desktop/综合/项目/ITS` |
| GitHub | `https://github.com/wangjiantao520/its.git` |
| 主分支 | `main` |
| 交付基线提交 | `f53f86000c7df42a68ce8a0821b3447c3212b548` |
| 本地备份分支 | `backup/local-main-before-sync-20260810` |
| Coze 项目 | `https://code.coze.cn/p/7642547135774441524` |
| Coze 站点 | `https://itsbjxt.coze.site`（需重新做完整线上验收） |
| Supabase 项目 | `rubclqrbdsypvixvwqhk` |
| Claude 模型 | `deepseek-v4-flash`（保持用户 Gateway 配置） |

当前本地存在尚未提交的交接文件和 `AGENTS.md` 更新，这是正常状态，不得执行 reset/checkout 清除。根目录未跟踪的 `trae-agent/` 属于用户内容，禁止修改、删除或提交。

接手后的第一组命令：

```bash
git status --short --branch
git log -1 --oneline
git diff --check
```

## 三、技术架构

- Next.js 16.2.10 App Router、React 19.2.3、TypeScript 5.9.3。
- Tailwind CSS 4、shadcn/ui、Radix UI。
- 只允许 pnpm，禁止 npm/yarn；锁文件必须保留。
- 自定义服务入口：`src/server.ts`。
- 生产构建：`scripts/build.sh`。
- 生产启动：`scripts/start.sh`，默认端口 5000；启动前执行幂等 PostgreSQL 迁移。
- 生产数据层：Supabase PostgreSQL，客户端为 `postgres`。
- Web/API 运行时已经移除 `better-sqlite3`，不得重新引入 SQLite 原生依赖。
- SQLite 仅允许用于一次性历史数据迁移工具。

关键目录：

| 路径 | 作用 |
| --- | --- |
| `src/app/` | 页面和 API 路由 |
| `src/lib/database/` | PostgreSQL 客户端、迁移、仓储 |
| `src/lib/auth.ts`、`src/lib/api-auth*.ts` | 登录、会话、鉴权 |
| `src/lib/ai-*.ts` | AI 模型与助手能力 |
| `src/lib/quote-*.ts` | 报价计算和聚合 |
| `tests/` | 单元、集成、端到端测试 |

## 四、已经完成的工作

- 生产运行从 SQLite 迁移到 Supabase PostgreSQL。
- 登录、用户、配置、报价、版本、分享、审核、看板、AI 助手、导入和初始化接口已迁移到 PostgreSQL。
- 历史迁移核验记录：27 张业务表、475 行数据与 SQLite 来源一致。
- 当前 Supabase `public` schema 通过 MCP 只读验证为 29 张表。
- 最近一次完整测试基线：163 项通过、0 项失败；14 项因缺少隔离的 `TEST_DATABASE_URL` 明确跳过。
- TypeScript、ESLint、生产构建通过，构建生成 63 个页面/API 路由。
- Coze 环境标记已改为 `ITS_PROJECT_ENV=PROD`，解决平台保留前缀问题。
- Coze 生产运行不再加载 SQLite 原生二进制，因此不应再出现 `GLIBC_2.38` 错误。
- 侧边栏收起、窄图标导航和图标跳转功能应继续保留。

上述结果是交接基线。任何后续修改都必须重新运行验证，不能直接沿用“已通过”的结论。

## 五、Claude Desktop 已安装能力

- Customize → Skills 已安装并启用：
  - `its-project`
  - `coze-deploy`
- 项目内同时保留：
  - `.claude/skills/its-project/SKILL.md`
  - `.claude/skills/coze-deploy/SKILL.md`
- Supabase MCP：`supabase-its-readonly`。
- MCP 状态已验证为 `running`，OAuth 已完成。
- MCP 已限定项目 `rubclqrbdsypvixvwqhk`、`read_only=true`，功能组仅 `database,docs,debugging`。
- 实测成功调用 `List tables`，只列出表名和数量，没有读取行数据或执行写入。

Supabase 当前提示 29 张表未启用 RLS。用户已经明确“安全问题暂时不用考虑，先完成功能”，因此只能记录该问题，不得擅自启用 RLS、修改策略或改变数据库访问方式。

## 六、最高优先级未完成事项

按以下顺序继续，不进行整体重写：

1. **线上状态复核**：检查 Coze 当前部署提交、构建日志、启动日志和 `/healthz`，确认站点不是旧缓存或旧提交。
2. **三角色回归**：管理员、普通成员、未登录用户分别遍历页面和 API，记录真实结果。
3. **全功能点击验收**：逐项验证新增、编辑、保存、删除、复制、分享、审核、版本、打印、导出、跳转、刷新和查看详情，不能用隐藏按钮规避功能。
4. **数据持久化**：创建测试报价，刷新和重新登录后确认仍存在，再按业务规则清理测试数据。
5. **AI 功能**：无真实 Key 时执行模拟的成功、超时、断流、鉴权失败和异常格式测试；有 Key 后再做真实连通测试。
6. **PostgreSQL 集成测试**：取得隔离的 `TEST_DATABASE_URL` 后补跑被跳过的 14 项测试；禁止使用生产数据库作为测试库。
7. **移动端和侧边栏**：验证展开/收起、移动抽屉、页面无遮挡、无横向溢出、折叠图标仍可跳转。

Coze 工作区若出现额外的 merge/restore 提交，不得直接推回 GitHub；必须先审查差异，确认没有回退 PostgreSQL、认证或环境变量修复。

## 七、Coze 环境变量

| 名称 | 要求 |
| --- | --- |
| `DATABASE_URL` | 必填，Supabase Transaction Pooler TLS URI |
| `ADMIN_PASSWORD` | 必填，管理员密码 |
| `ITS_PASSWORD` | 必填，成员密码 |
| `ITS_PROJECT_ENV` | 设置为 `PROD` |
| `DEEPSEEK_API_KEY` | 真实 AI 功能需要 |
| `DEEPSEEK_API_URL` | 可选 |
| `DEEPSEEK_MODEL` | 可选 |

硬性要求：

- 自定义变量禁止使用 `COZE_` 前缀。
- 密码、数据库 URI、Token、API Key 不得写入代码、文档、Git、聊天、截图或日志。
- `DATABASE_MIGRATION_URL` 可不设置，启动脚本会回退使用 `DATABASE_URL`。
- 不得更换或重置用户现有账号密码。

## 八、代码修改规则

- 先复现、再定位、再做最小修改。
- 保留现有数据、路由、页面地址和 UI 风格，不做无关视觉重做。
- TypeScript 保持严格类型，禁止隐式 `any` 和 `as any`。
- 使用 shadcn/ui 现有组件和设计规范。
- 不得执行 `git reset --hard`、强制推送或覆盖用户未提交内容。
- 数据库迁移必须幂等；任何正式数据写入、删除、批量迁移前先停下请求用户确认。
- 没有实际命令结果、HTTP 响应或页面证据时，不得声称“已经修好”或“全部通过”。

## 九、验证与完成标准

本地交付前运行：

```bash
pnpm install --frozen-lockfile
pnpm validate
pnpm test
pnpm build
```

需要隔离 PostgreSQL 测试时：

```bash
TEST_DATABASE_URL='通过安全环境注入' pnpm test
```

线上完成标准：

- `/healthz` 返回 HTTP 200 和 `{"status":"ok"}`。
- 管理员与成员均能登录，未登录用户无法访问受保护数据。
- 看板、报价、历史、数据库、分享、AI 页面不再卡“加载中”。
- 新增数据刷新后仍存在。
- 所有可见按钮点击后有结果、加载态或明确错误提示。
- 桌面端与移动端侧边栏无遮挡，折叠图标可跳转。
- 控制台和服务日志无未预期的 hydration、JSON、SQLite、GLIBC、401/403/500 错误。
- 明确列出所有跳过项；不能把部分通过描述成全部通过。

## 十、给 Claude 的首条指令

复制以下内容给 Claude：

> 你现在接管 ITS 系统。项目目录是 `/Users/wangjiantao/Desktop/综合/项目/ITS`。先完整阅读 `CLAUDE.md`、`AGENTS.md` 和 `docs/CLAUDE_HANDOFF.md`，调用 `its-project` 技能；涉及 Coze 时再调用 `coze-deploy`。先运行 `git status --short --branch`、`git log -1 --oneline` 和 `git diff --check`，只审查并汇报当前状态、未提交内容、交付基线和最高优先级下一步，不要立即修改代码，不要输出密钥，不要处理 RLS。确认后从“线上状态复核和全功能验收”开始，所有结论必须附真实命令或页面证据。
