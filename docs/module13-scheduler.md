# 模块13：⏰ 定时任务

> **学完时间：** 2026-06-07
> **验证项目：** `/scheduler` 定时诊断管理页面
> **核心库：** `lib/scheduler.ts`
> **API端点：** `/api/cron/daily-diagnosis`、`/api/scheduler/tasks`、`/api/scheduler/history`

## 学到的技能

### 1. node-cron 集成

安装：`npm install node-cron @types/node-cron`

核心用法：
```typescript
import cron from 'node-cron';

// 每天早上8点执行
cron.schedule('0 8 * * *', () => {
  runAllTasks();
});
```

但在 Serverless 环境中（Zeabur），node-cron 不是长期运行的。实际方案：

### 2. 外部Cron服务驱动方案

```
cron-job.org (免费)
  └── 每天8:00 GET /api/cron/daily-diagnosis
       └── 遍历 scheduled_diagnoses 表
            └── 对每个URL执行SEO诊断
                 └── 评分 + 保存历史
```

### 3. 数据库设计

**scheduled_diagnoses 表** — 定时任务配置：
```sql
id SERIAL PRIMARY KEY,
url VARCHAR(2048) NOT NULL,
user_id INTEGER,
cron_expression VARCHAR(100) DEFAULT '0 8 * * *',
is_active BOOLEAN DEFAULT true,
last_run TIMESTAMP,
created_at TIMESTAMP
```

**diagnosis_history 表** — 执行历史：
```sql
id SERIAL PRIMARY KEY,
url VARCHAR(2048) NOT NULL,
score INTEGER,
grade VARCHAR(2),
status VARCHAR(20),  -- success / failed
error_message TEXT,
executed_at TIMESTAMP
```

### 4. 完整任务管理API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/scheduler/tasks` | GET | 获取用户的所有定时任务 |
| `/api/scheduler/tasks` | POST | 添加新的定时诊断URL |
| `/api/scheduler/tasks?id=X` | DELETE | 停用指定任务 |
| `/api/scheduler/history` | GET | 获取执行历史 |
| `/api/scheduler/history?type=stats` | GET | 获取统计概览 |
| `/api/cron/daily-diagnosis` | GET/POST | 触发全部定时诊断执行 |

### 5. 管理页面功能

- 添加/停用定时诊断URL
- 立即手动执行所有任务
- 查看执行历史与结果
- 概览统计卡片（总次数/成功/失败/平均分）
- 外部Cron服务配置指南

## 验证结论

| 要求 | 实现 |
|------|------|
| 定时任务配置 | ✅ node-cron + 外部cron服务双方案 |
| 自动执行任务 | ✅ 遍历所有活跃URL执行SEO诊断 |
| 执行历史记录 | ✅ diagnosis_history 表持久化 |
| 任务启停控制 | ✅ 添加/停用功能 |
| 定时任务管理界面 | ✅ `/scheduler` 页面 |

**模块13：学完了 ✅**
