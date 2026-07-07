# AI VIDEO WORKSTATION — Two Core Developer Collaboration Rules

本项目由两名核心开发者长期共同开发。双方均拥有 Repository **Write** 权限，可创建分支、提交、推送、发起 PR 并合并。**不设置强制 Code Review 或 Approval。**

## 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 可运行稳定主线；进入 `main` 的代码原则上应能启动 |
| `dev/<name>` | 个人日常开发（例：`dev/friend`） |
| `feature/<name>` | 功能开发 |
| `fix/<name>` | Bug 修复 |
| `repair/<name>` | 架构维修（例：`repair/control-chain`） |
| `hotfix/<name>` | 紧急修复 |

**不建议两个人同时修改同一个核心文件。**

## 日常流程

```bash
git pull
# … 开发 …
git status
git add <files>
git commit -m "type: description"
git push
```

双方均可 Merge PR，但不要求强制 Review。

## 冲突处理

禁止使用以下命令直接覆盖对方代码：

```bash
git reset --hard
git clean -fd
```

应使用 `git merge` / `git rebase`（协商后）手动解决冲突。

## 架构控制权（维修期）

当前唯一架构控制权定义：

| 领域 | 负责人 |
|------|--------|
| Director | `runDirectorPipeline` |
| Duration | `planNarrativeDuration` |
| Timeline | `EditGraph.timeline` |

修改以上三个控制权相关模块前，**必须先追踪现有生产调用链**。目的：防止重新引入并行控制器。这不是审批制度，是技术约束。

维修原则：

1. 先统一生产主链控制权  
2. 再处理持久化  
3. 最后评估和引入开源项目  

## Secret 与配置

- **禁止**将 API Key、Token、Password、Private Key 提交到 Git  
- `.env.local` 仅存在于本地  
- 使用 `.env.example` 和 `database/.env.example` 描述变量名与配置结构  
- 协作者 clone 后执行 `cp .env.example .env.local`，填入自己的密钥即可获得相同 Provider 配置结构

## 首次加入

```bash
git clone https://github.com/jiangfei491-gif/ai-video-workstation.git
cd ai-video-workstation
cp .env.example .env.local
cp database/.env.example database/.env.local   # 如需 PostgreSQL
npm install
npm run dev
git checkout -b dev/<your-name>
git push -u origin dev/<your-name>
```
