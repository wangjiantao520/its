# 系统功能全面检查与修复计划

## 概述

对现有系统所有功能模块进行全面端到端检查，识别并修复：
- 无响应的按钮/功能
- 跳转不正常的路由
- 只有 UI 没有真实功能的模块
- 占位 TODO/FIXME

## 技术方案

| 维度 | 选择 | 理由 |
|---|---|---|
| 检查范围 | 所有页面 + API 路由 | 全覆盖，不遗漏任何功能 |
| 检查方式 | 端到端（UI → API → 数据库） | 不只是静态代码分析，实际测功能 |
| 修复优先级 | 按钮无响应 > 跳转异常 > TODO | 影响用户使用的优先 |
| 验证方式 | test_run + 手动验证 | 静态检查 + 实际行为 |

## 功能模块清单与检查要点

### 1. 报价相关模块
- `src/app/quotes/page.tsx`：报价单列表、批量操作、搜索筛选
- `src/app/maintenance/page.tsx`：维保报价、保存、导出
- `src/app/engineering/page.tsx`：工程报价、自施工定额、智能化项目
- `src/app/reports/page.tsx`：报告生成

### 2. 设备相关模块
- `src/app/device-import/page.tsx`：设备导入、预览、确认
- `src/app/device-review/page.tsx`：设备审核、修改、提交

### 3. 客户与管理模块
- `src/app/clients/page.tsx`：客户管理、增删改查
- `src/app/admin/users/page.tsx`：用户管理（仅管理员）
- `src/app/history/page.tsx`：操作历史、审计日志

### 4. 系统模块
- `src/app/dashboard/page.tsx`：数据看板
- `src/app/data/page.tsx`：数据管理
- `src/app/database/page.tsx`：数据库管理
- `src/app/settings/ai-models/page.tsx`：AI 模型配置
- `src/app/survey-upload/page.tsx`：勘测上传

### 5. AI 功能
- `src/hooks/use-ai-assistant.ts`：AI 助手 Hook
- `src/components/ai-assistant/*`：AI 组件（语音、反馈、推荐、批量编辑）
- API 路由：`/api/ai-parse-quote`、`/api/ai-parse-engineering`、`/api/ai-models/*`

## 是否有原型设计

否

## 实施步骤

1. **检查报价单列表页面（quotes/page.tsx）**：验证批量操作（批准/导出/归档）是否有真实功能，搜索筛选是否正常工作
2. **检查维保/工程报价页面**：验证保存、AI 解析、导出 PDF 是否有真实功能
3. **检查设备模块**：验证设备导入预览、确认、审核是否有真实功能
4. **检查客户/用户/历史模块**：验证增删改查是否有真实功能
5. **检查系统模块**：验证看板、数据库、AI 模型配置、勘测上传是否有真实功能
6. **检查 AI 功能**：验证语音输入、反馈、推荐、批量编辑是否有真实功能
7. **全面修复发现的问题**：统一修复所有发现的无响应按钮、未实现功能
8. **端到端验证**：运行静态检查 + 运行时冒烟测试

## 页面规格（本次不新增页面）

仅修复现有功能，不新增页面，故省略页面规格。
