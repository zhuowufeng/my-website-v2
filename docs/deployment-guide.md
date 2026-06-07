# 🚀 墨言AI写作助手 — 部署指南

> 给老板的部署说明书 · 5分钟搞定

---

## 前置条件

- ✅ Zeabur 账号（已注册）
- ✅ GitHub 账号（已连接 Zeabur）
- ✅ 本机已有项目代码

---

## 步骤一：推送到 GitHub

打开终端（PowerShell/CMD），进入项目目录：

```bash
cd C:\Users\zhuowufeng\.openclaw\workspace\my-website-v2-temp

# 初始化 Git（如果还没做）
git init
git add -A
git commit -m "墨言v3 - AI写作助手 + 安全加固 + 性能优化"

# 推送到 GitHub
# 👇 把 YOUR_REPO_URL 换成你 GitHub 上的仓库地址
git remote add origin https://github.com/YOUR_USERNAME/moyan-ai-writer.git
git push -u origin main
```

> 如果 GitHub 上没有仓库，先去 github.com 新建一个，名字随便（比如 `moyan-ai-writer`），复制它的 HTTPS 地址粘贴到上面。

---

## 步骤二：Zeabur 部署

1. 打开 [Zeabur Dashboard](https://dash.zeabur.com)
2. 点击 **新建项目** → **从 GitHub 导入**
3. 选择刚推送的仓库
4. Zeabur 会自动检测这是 Next.js 项目
5. 部署设置（如果自动检测没填，手动设置一下）：
   - **构建命令：** `npm run build`
   - **启动命令：** `npm start`
6. 点击 **部署**

---

## 步骤三：配置环境变量

部署后，在 Zeabur 项目 → **环境变量** 设置：

| 变量名 | 说明 | 从哪里获取 |
|--------|------|-----------|
| `DATABASE_URL` | 数据库连接地址 | Zeabur 里创建一个 PostgreSQL 数据库，拿到连接字符串 |
| `NEXT_PUBLIC_BASE_URL` | 你的域名 | 比如 `https://moyan.zeabur.app` 或你自己的域名 |
| `OPENAI_API_KEY` | AI写作的 API key | 你的 OpenAI / DeepSeek 等 API Key |

设置方法：
1. 在 Zeabur 项目页面 → **Environment Variables**
2. 逐个添加上面的变量
3. 保存后**重新部署**才能生效

---

## 步骤四：配置数据库

Zeabur 里创建 PostgreSQL 数据库：
1. 在 Zeabur 项目 → **新建组件** → **PostgreSQL**
2. 等它创建完成
3. 复制 `DATABASE_URL` 粘贴到环境变量里
4. 重新部署一次，数据库表会自动创建

---

## 步骤五：绑定域名（可选）

1. Zeabur 项目 → **Networking**
2. 输入你的域名（比如 `moyan.yourdomain.com`）
3. 在你的域名 DNS 管理里加一条 CNAME 记录，指向 Zeabur 分配的地址
4. Zeabur 自动处理 HTTPS 证书

---

## 检查清单 ✅

部署成功后，检查这些功能：

- [ ] 打开网站 → 看到首页
- [ ] 点击「开始写作」→ 进入墨言写作工具
- [ ] 输入主题，点击生成 → AI开始生成内容
- [ ] 生成完后 → 文章自动保存到历史记录
- [ ] 历史记录 → 可以查看、继续写、删除
- [ ] 登录功能 → 可以注册/登录
- [ ] 博客页面 → 博客文章能正常打开
- [ ] 手机打开 → 布局适配正常

---

## 常见问题

### ❌ 网站打开404
Zeabur 部署需要几分钟。等状态变成绿色（Running）后再访问。

### ❌ AI生成报错
检查 `OPENAI_API_KEY` 环境变量是否正确设置。

### ❌ 数据库报错
检查 `DATABASE_URL` 环境变量，确保 PostgreSQL 组件已创建。

### ❌ 需要重新部署
每次推送代码到 GitHub 后，Zeabur 会自动重新部署。

手动也可以：Zeabur Dashboard → 项目 → Redeploy。

---

## 部署后要做的事

1. **Google Search Console** 提交网站
2. **Google Analytics** 查看访问数据
3. 检查变现系统（广告位正常显示）
4. 根据数据优化内容和功能

---

> 需要帮助？直接喊我 🦞
