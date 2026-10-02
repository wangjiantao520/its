# Vercel 部署

项目继续使用 Supabase PostgreSQL 保存业务数据。Vercel 运行 Next.js 原生函数，不启动 Coze 使用的 `src/server.ts` 自定义服务；附件通过 Supabase 私有 Storage 上传和下载。

## Vercel 构建

仓库的 `vercel.json` 将构建命令设为 `pnpm vercel-build`。该命令先运行 TypeScript 与 ESLint 检查，再执行 `next build`。Coze 仍使用现有 `pnpm build`、`scripts/start.sh` 与自定义服务器入口。

## 需要配置的环境变量

正式发布先只在 Vercel 的 `Production` 环境配置下表中的必需变量。`Preview` 和 `Development` 应连接隔离的非生产数据库与各自的密钥；不要直接复制生产 `DATABASE_URL` 或 `SUPABASE_SECRET_KEY`。如果暂时没有隔离环境，可以先不启用这两个环境。

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | 必填。Supabase PostgreSQL 事务池连接串，使用 Supabase Connect 页面提供的 Transaction pooler URI（通常为 6543 端口）。Vercel 每个运行实例默认使用 1 个应用连接。 |
| `SUPABASE_DB_CA_CERT_BASE64` | 必填。Supabase 数据库根 CA 证书的 Base64 值。到 Database Settings 下载官方 `prod-ca-2021.crt`，将证书文件 Base64 编码后配置；Vercel 会据此校验数据库服务端证书。 |
| `ADMIN_PASSWORD` | 必填。管理员环境密码回退值。 |
| `ITS_PASSWORD` | 必填。成员登录环境密码。 |
| `NEXT_PUBLIC_SUPABASE_URL` | 必填。Supabase 项目 API URL，供浏览器直传使用。 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 必填。Supabase publishable key；旧项目可改用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。该值可公开。 |
| `SUPABASE_SECRET_KEY` | 必填。服务端 Storage 管理密钥；旧项目可改用 `SUPABASE_SERVICE_ROLE_KEY`。严禁设置为 `NEXT_PUBLIC_` 变量。 |
| `SUPABASE_STORAGE_BUCKET` | 私有附件桶名称，当前值为 `quote-library`；代码默认同名。 |
| `DEEPSEEK_API_KEY` | 可选 AI 环境覆盖；未设置时使用数据库 `ai_model_configs` 中的激活模型。设置后会优先于数据库配置。 |
| `DEEPSEEK_API_URL`、`DEEPSEEK_MODEL`、`DEEPSEEK_PROVIDER` | 可选 AI 环境覆盖参数；仅在通过 `DEEPSEEK_API_KEY` 启用环境覆盖时使用。 |
| `DATABASE_POOL_MAX` | 可选，应用连接池上限。Vercel 默认 1；非 Vercel 自定义服务器默认 10。 |

数据库 URI、密钥和密码应直接录入 Vercel 环境变量，不要提交到仓库或放进客户端代码。Supabase transaction pooler 不支持 prepared statements 或 query pipelining；Vercel 路径使用 `pg` 驱动、单连接池、无命名 prepared statement，并用 Supabase CA 验证 TLS。

## 创建私有附件桶

在正确的 Supabase 项目中创建名为 `quote-library` 的 **Private** bucket，并将文件大小上限设为 20 MB。不要把工程报价附件设为公开桶。项目使用 `hnd1`（东京）运行函数，靠近东京的 Supabase 数据库；可在 `vercel.json` 中调整。上传接口由应用管理员鉴权后签发限时上传授权，下载接口先检查应用会话及资料发布状态，再生成短时下载链接。

如果使用自定义桶名，同时设置 `SUPABASE_STORAGE_BUCKET`。`NEXT_PUBLIC_SUPABASE_URL` 与 publishable key 必须在 Vercel 构建前配置，因为它们会进入浏览器端上传代码。

## 迁移旧本机附件

旧数据库记录可能仍引用 `public/uploads/quote-library/...` 文件。Vercel 函数的本地文件系统不适合作为持久附件存储；迁移前先确认本机仍有原附件文件，并确认环境变量指向要迁移的 Supabase 项目。

先运行只读预览：

```bash
pnpm db:migrate-quote-library-storage
```

预览会统计数据库中的旧附件、当前 checkout 能找到的文件、缺失文件和超过 20 MB 的文件，不会上传文件或更新数据库。核实项目和统计后，才可显式写入 Storage 并更新数据库路径：

```bash
pnpm db:migrate-quote-library-storage -- --apply
```

迁移保留原本机文件作为回退副本。缺失或超限的文件不会迁移；上线前应处理这些记录。此命令会写入 Supabase Storage 并更新 `quote_library_attachments.stored_path`，必须从保存原附件的机器运行。

## 发布前检查

1. 确认 Supabase 项目已恢复且数据库中包含迁移 1–9；部署不会在 Vercel 冷启动时自动运行数据库迁移。
2. 配齐上述 Vercel 环境变量，Production 与 Preview 连接到预期数据库。
3. 建立私有 Storage bucket；先在 Preview 验证管理员上传、下载与非管理员访问限制。
4. 旧附件完成迁移并复核缺失/超限数量后，再将 Production 域名指向正式部署。

即使本仓库的本地检查和构建通过，也不代表已经完成 Vercel 环境变量设置、远端附件迁移或线上发布。

## Vercel 计划要求

此系统服务于工程报价与维保业务。Vercel 当前将 Hobby 计划限制为非商业个人用途，商业部署要求 Pro 或 Enterprise。开始 Production 部署前，应确认该项目所在 Vercel 团队具备适用的计划。
