# Claude 接管安装说明

桌面版安装状态（2026-08-10）：

- 已在 Claude Desktop 的 **Customize → Skills** 中安装 `its-project`。
- 已在 Claude Desktop 的 **Customize → Skills** 中安装 `coze-deploy`。
- 已写入项目级只读 Supabase MCP 配置，并通过桌面版 `mcp-remote` 桥接完成 OAuth。
- Claude Desktop 已显示 `supabase-its-readonly` 为 `running`；只读调用 `List tables` 成功识别 `public` schema 的 29 张表，未读取行数据、未执行写入。
- 已使用 `deepseek-v4-flash` 启动一次最小只读验证会话；未改动现有 Gateway 或模型选择。

## 已放入项目的配置

- `CLAUDE.md`：Claude 启动时自动读取的项目约束。
- `.claude/skills/its-project/SKILL.md`：ITS 开发与验证技能。
- `.claude/skills/coze-deploy/SKILL.md`：Coze 部署排障技能。
- `.mcp.json`：仅绑定本项目的只读 Supabase MCP。

这些文件不包含密码或 API Key。DeepSeek-v4-flash 的模型/网关配置保持不变。

## 第一次启动（Claude Desktop）

1. 打开 Claude Desktop，顶部模式选择 **Code**，不要选择普通 Chat。
2. 选择已有项目 **ITS**；本机已登记目录 `/Users/wangjiantao/Desktop/综合/项目/ITS`。
3. 保持现有模型 `deepseek-v4-flash`，不要改动用户的 Gateway 配置。
4. 首次发现项目级 `.mcp.json` 时，批准 `supabase` 项目连接。
5. 在会话输入 `/mcp`，选择 `supabase`，在浏览器完成 OAuth。

MCP 已限定到项目 `rubclqrbdsypvixvwqhk`、只读模式及最少功能组，不需要把数据库密码交给 Claude。

Claude Desktop 的 **Cowork** 也可以把 ITS 文件夹作为项目上下文，但修复代码应优先使用 **Code** 模式；Code 模式会读取项目根目录的 `CLAUDE.md`、`.claude/skills/` 和 `.mcp.json`。

## 可选桌面版技能上传

项目技能已经安装在 `.claude/skills/`，只对 ITS 生效。若希望在普通 Chat/Cowork 中也使用，可进入 **Customize → Skills → + → Create skill → Upload a skill**，上传对应技能 ZIP。不要把 ITS 项目技能设为无关项目的默认指令。

## 可选官方 Supabase 插件

`.mcp.json` 已足够完成数据库只读检查。若还需要 Supabase 官方工作流，可在桌面版 **Customize → Plugins** 中搜索 Supabase。它不是接管 ITS 的必需项，也不要重复安装多个同类数据库插件。

## 验证接管成功

让 Claude 执行以下只读任务：

> 读取 CLAUDE.md 和 docs/CLAUDE_HANDOFF.md，显示当前分支与最新提交；再通过 Supabase MCP 只读列出数据库表名。不要修改文件或数据库，不要显示任何连接串。

成功标准：

- 能识别 `main` 与当前提交。
- 能自动发现两个项目技能。
- Supabase MCP 显示已连接并只能读取指定项目。
- 输出中没有密码、连接串或 API Key。
