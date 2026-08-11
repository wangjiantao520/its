# Claude 任务续接：工程报价三套取费

更新时间：2026-08-11

## 续接原则

- 以当前工作区实际代码和 Git diff 为准，不依赖旧对话记忆。
- 当前分支为 `main`，基线提交为 `b39430c`，工作区存在大量未提交改动。
- 禁止 reset、checkout、回滚、覆盖或批量格式化现有改动。
- 禁止读取、输出或提交 `.env` 及任何密钥。
- 先运行 `git status --short`、`git diff --check` 并阅读本文件，再继续修改。

## 当前任务目标

在现有工程报价页增加并完成：

1. 三套取费并行计算：
   - 普通含税价：基价 × `1.06`
   - 铁建价：普通含税价 × `1.06`
   - 移动价：铁建价 × `1.08`
2. 采购价加价链路：采购价 × `(1 + 加价率)` 得到报价基准价。
3. 明细行归属位置（楼层）字段。
4. 保存、恢复、导出和数据库字段完整贯通。

按次维护服务报价不属于本次任务，不修改维保模块。

## 已经完成的工作

- 新增 PostgreSQL 迁移 `008_engineering_quote_tiers.sql`：
  `crcc_rate`、`crcc_fee`、`cmcc_rate`、`cmcc_fee`。
- 迁移已加入 manifest、运行时复制列表和相关测试。
- Supabase 已确认上述 4 列存在。
- 工程报价 API 已支持保存和更新 4 个三套取费字段。
- `QuoteItem` 已增加 `location`、`purchasePrice`、`markupRate`。
- 工程页已经加入三套取费开关、三组费率、采购价/加价率、归属位置输入和汇总展示。
- 保存、加载回显与 items JSON 已加入新增字段。
- 后端 API 保存/读取测试已通过；测试报价已经清理。
- 已用已知数据验证主要计算：基价 220、数量 68 时，普通含税 15857.60、铁建 16809.06、移动 18153.78。
- 上一次记录为构建通过；自动化测试除 1 项既有偶发项外通过。必须重新运行确认，不能直接宣称当前全部通过。

## 精确中断点

旧对话因为 DeepSeek 1M 上下文超限而终止。最后正在修复
`src/app/engineering/page.tsx` 三类明细行的实时移动价显示。

当前 3 处移动价公式少乘了铁建系数 `crccFactor`：

- 约第 2305 行：自定义明细
- 约第 2402 行：人工明细
- 约第 2479 行：定额明细

当前错误模式：

```ts
base * quantity * taxFactor * cmccFactor
```

应与已验证的汇总和导出计算保持一致：

```ts
base * quantity * taxFactor * crccFactor * cmccFactor
```

人工明细按其现有数量表达式处理，不要机械加入错误的 `quantity`。

同时检查移动总价标签是否准确表达三段链路，避免只显示“税率 + 移动费率”而漏掉铁建费率。

## 继续实施的顺序

1. 只修改上述 3 处移动价实时显示及对应标签。
2. 搜索所有 `cmccRate`/`cmccFactor`，确认页面显示、汇总、保存和导出公式一致。
3. 检查 `handleLoadQuote` 对 PostgreSQL 返回的 `items`：数组与 JSON 字符串两种情况都应可靠恢复，避免刷新后新增字段丢失。
4. 检查 Word/HTML、Excel、PDF 导出是否都包含三套价格和归属位置；不要只验证数据结构。
5. 运行：

```bash
pnpm validate
pnpm test
pnpm build
```

6. 本地生产服务使用端口 `5001`（macOS Control Center 占用 `5000`），完成页面和 API 冒烟测试。
7. 以管理员、ITS 成员、未登录三种身份验证权限，不创建无法清理的正式业务数据。
8. 汇报精确通过/失败/跳过数量和仍未完成事项；未验证的功能不得写成完成。

## 当前工作区保护范围

以下文件存在与本次任务直接相关的改动，必须保留：

- `scripts/database/migration/manifest.ts`
- `src/app/api/engineering-quotes/route.ts`
- `src/app/engineering/engineering-helpers.ts`
- `src/app/engineering/page.tsx`
- `src/lib/database/postgres-migrations.ts`
- `src/lib/database/sql/008_engineering_quote_tiers.sql`
- `src/lib/export-utils.ts`
- `tests/coze-postgres-runtime.test.ts`
- `tests/helpers/postgres-schema.ts`
- `tests/postgres-migrations.test.ts`

工作区还存在助手、首页、认证、侧边栏以及新文件等其他未提交改动。它们可能来自此前任务，不能删除、回滚或混入本次逻辑重写：

- `src/app/assistant/page.tsx`
- `src/app/page.tsx`
- `src/components/auth-protected.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/ai-chat.tsx`
- `src/lib/file-content.ts`

## 给新对话的第一条指令

请先完整阅读 `AGENTS.md` 和 `docs/CLAUDE_TASK_CONTINUATION.md`，然后检查当前 `git status` 与相关 diff。不要读取 `.env`，不要回滚任何现有改动。从文档所列的 3 处移动价公式中断点继续，完成剩余实现、验证和准确汇报。
