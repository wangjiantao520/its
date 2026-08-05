# ITS 系统交付状态与 Coze 下一步操作

更新时间：2026-08-05

## 一、当前已经完成

- 最新代码已推送到 GitHub：`wangjiantao520/its-new` 的 `main` 分支。
- 当前 Git 提交：`616b8b6`。
- 已移除运行时 `better-sqlite3`，Coze 不再加载 SQLite 原生二进制，因此不再依赖 `GLIBC_2.38`。
- 登录、用户、配置、报价、版本、分享、审核、看板、AI 助手、导入和初始化接口已迁移到 PostgreSQL。
- 自动化测试：163 项通过，0 项失败；14 项需要数据库连接串的集成测试此前明确跳过。
- TypeScript、代码检查和生产构建通过；Next.js 成功生成 63 个页面/API 路由。
- Supabase 项目 `rubclqrbdsypvixvwqhk` 已恢复为正常状态，数据库结构已建立。
- 原 SQLite 数据已导入 Supabase：27 张业务表共 475 行，逐表行数与源数据库一致。
- 本地已生成完整 SQLite 备份，原数据库仍保留，未做破坏性删除。

## 二、现在只需要完成这一件事

在 Coze 项目中配置 Supabase PostgreSQL 连接串，然后重新部署。

### 1. 获取连接串

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard/project/rubclqrbdsypvixvwqhk)。
2. 点击页面上方的 **Connect**。
3. 选择 **Transaction pooler**。
4. 复制 URI 连接串。
5. 将连接串中的 `[YOUR-PASSWORD]` 替换为该 Supabase 项目的数据库密码。
6. 如果 URI 没有 TLS 参数，在末尾添加 `?sslmode=require`；如果已有查询参数，则添加 `&sslmode=require`。

不要把数据库连接串发送到聊天、GitHub 或截图中。

### 2. 在 Coze 设置环境变量

进入 Coze 项目：**设置 → 环境变量**，添加：

| 变量 | 必填 | 内容 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | 上一步复制的 Transaction pooler URI |
| `ADMIN_PASSWORD` | 是 | 管理员登录密码，由你自己设置 |
| `ITS_PASSWORD` | 是 | ITS 成员登录密码，由你自己设置 |
| `COZE_PROJECT_ENV` | 建议 | `PROD` |
| `DEEPSEEK_API_KEY` | AI 功能需要 | DeepSeek API Key |
| `DEEPSEEK_API_URL` | 可选 | 不填则使用代码默认地址 |
| `DEEPSEEK_MODEL` | 可选 | 不填则使用代码默认模型 |

`DATABASE_MIGRATION_URL` 可以暂时不填。启动脚本会在它缺失时使用 `DATABASE_URL` 执行幂等数据库迁移。

### 3. 重新拉取并部署

1. 确认 Coze 连接的仓库是 `wangjiantao520/its-new`。
2. 确认分支是 `main`，最新提交应为 `616b8b6`。
3. 点击 **Pull/同步代码**。
4. 清理旧构建缓存（如果 Coze 提供该选项）。
5. 点击 **部署**，等待构建和服务启动完成。

## 三、部署后验收

依次检查：

1. 打开 `https://你的域名/healthz`。
2. 正常结果应为 HTTP 200：

```json
{"status":"ok"}
```

3. 管理员登录：选择管理员入口，密码使用 `ADMIN_PASSWORD`。
4. 成员登录：用户名 `its`，密码使用 `ITS_PASSWORD`。
5. 检查首页看板、工程报价、维护报价、历史记录、数据库管理和 AI 助手。
6. 新建一条测试报价，刷新页面确认数据仍存在。
7. 测试报价详情、复制、版本保存、分享和删除。

## 四、错误快速判断

| 日志或现象 | 原因 | 处理 |
| --- | --- | --- |
| `DATABASE_URL is required for PostgreSQL startup` | Coze 未配置连接串 | 添加 `DATABASE_URL` 后重新部署 |
| `Database migration failed` | 地址、密码、TLS 或 Supabase 状态不正确 | 重新复制 Transaction pooler URI，检查密码和 `sslmode=require` |
| `/healthz` 不是 200 | 应用未连上 PostgreSQL | 查看 Coze 启动日志中的首个数据库错误 |
| 登录提示 500 | 数据库连接失败或迁移未完成 | 先确认 `/healthz`，再重新部署 |
| AI 助手提示模型不可用 | 未配置 AI Key 或模型配置不正确 | 配置 `DEEPSEEK_API_KEY`，再在 AI 模型设置页测试 |
| 仍出现旧的 GLIBC/SQLite 报错 | Coze 使用了旧提交或旧缓存 | 确认提交 `616b8b6`，清缓存后重新构建 |

## 五、目前还没有完成的事项

- Coze 的 `DATABASE_URL` 尚未配置，因此尚未完成 Coze 线上登录和页面实测。
- 尚未使用数据库连接串运行完整的 PostgreSQL 并发集成测试；当前 Supabase 已完成真实建表、数据导入和逐表数量核对。
- 尚未在 Coze 线上逐个点击全部按钮；本地自动化测试和生产构建已通过。
- 外部 AI 真实连通测试需要 `DEEPSEEK_API_KEY`。
- `data/quotation.db` 暂时仍在 Git 历史和当前仓库中，但生产运行不会读取它；在完成线上最终核验后再移除。

## 六、完成标准

满足以下条件即可认为部署完成：

- `/healthz` 返回 200 和 `{"status":"ok"}`。
- 管理员和 ITS 成员均可登录。
- 首页、报价、历史和数据库页面可以正常显示，不再长期停留在“加载中”。
- 新增报价后刷新仍存在。
- Coze 控制台没有 GLIBC、SQLite、非 JSON 响应或未预期的 500 错误。

