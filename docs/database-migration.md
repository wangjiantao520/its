# SQLite 到 PostgreSQL 切换手册

1. 停止所有 ITS Web/后台实例，确认没有进程继续写 SQLite；切换窗口内保持维护模式。
2. 将目标连接仅放入当前终端环境变量，避免写进命令历史：

   ```bash
   export DATABASE_MIGRATION_URL='postgresql://...'
   ```

3. 选择互不重叠的源库、备份目录和报告路径。导入器会只读检查源库、创建不可变快照，并拒绝覆盖任何数据文件。
4. 执行一次性导入：

   ```bash
   pnpm db:import-sqlite --source data/quotation.db --report data/migration-import-report.json --maintenance-mode-confirmed
   ```

5. 保持维护模式，再执行独立逐行核验：

   ```bash
   pnpm db:verify-migration --source data/quotation.db --report data/migration-verification-report.json
   ```

6. 只有两个命令均成功且报告中的 `success` 为 `true` 时，才把应用运行连接切换到 PostgreSQL 并恢复服务。SQLite 原库和生成的备份均保留，不做删除或覆盖。

若导入提示源库在备份期间变化，继续保持维护模式并从第 3 步重新执行。若报告写入失败，可用相同参数重跑；完成账本会返回既有结果，不会重复插入。
