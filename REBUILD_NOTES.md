# 茹意宝 v2 部署指南

> 这次升级新增了**家长教练 app** (`/parents`)，并对学生 app 做了易用性改进。
> 本文档说明部署步骤、迁移已有家长账号、以及配置注意事项。

## 这次升级有什么新东西

### 学生端 (`/`) — 微调
- ✏️ 题目框预填一道示例几何题（中点+辅助线）
- ✏️ "开始新会话" 改成 "开始陪练这道题"
- ✏️ 快捷输入按钮改在会话开始后才显示（之前是上来就显示，新用户会误点）
- ✏️ 新增"清空换成自己的"链接

### 家长端 (`/parents`) — 全新
- 🆕 10 张场景卡片首页（彤彤、浩浩、小雅、王鹏、小磊、小雨、浩宇、浩然、林菲菲、张宝山）
- 🆕 王鹰教授方法 AI 教练对话
- 🆕 严重信号 + 非紧急两种专家转介通道
- 🆕 留电话 → 后台员工接收

### 后台 (`/admin.html`) — 扩展
- 🆕 顶部 tab：「学生」 vs 「专家转介请求」
- 🆕 专家转介请求列表（按紧急程度排序，未联系优先）
- 🆕 单条请求详情页：完整对话 + AI 自动生成的对话摘要 + 可以加备注 + 标记已联系

---

## 部署步骤

### 第一步：把代码推到 GitHub（或直接 SCP 上去）

新增了这些文件，全部要上传：

```
db.js                                      ★ 替换原文件 (扩展了 schema)
parent_llm.js                              ★ 新文件
server.js                                  ★ 替换 (新增家长 + 专家请求路由)
server/scenarios.js                        ★ 新文件
server/prompts/01_framework.md             ★ 新文件
server/prompts/02_case_index.md            ★ 新文件
server/prompts/03_system_prompt.md         ★ 新文件
scripts/migrate_users_to_parent.js         ★ 新文件 (一次性迁移用)

public/index.html                          ★ 替换 (学生端微调 + 重定向家长)
public/login.html                          ★ 替换 (注册时分学生/家长)
public/admin.html                          ★ 替换 (新增专家请求 tab)
public/app.js                              ★ 替换 (示例提示 + 显示 quick-actions)
public/parents.css                         ★ 新文件
public/parents/index.html                  ★ 新文件 (10 张卡片首页)
public/parents/chat.html                   ★ 新文件 (聊天页面)
```

### 第二步：环境变量

`.env` 需要这些变量（前 4 个是原有的）：

```env
LLM_API_KEY=你的 GLM key
LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
LLM_MODEL=glm-4-flash                 # 学生 app 用 (便宜,够用)
MONGODB_URI=mongodb+srv://...
PORT=3000

# 家长 app 默认用 glm-4.6 (支持 prompt cache, 这部分不用配也行)
# 如果你想用别的模型 (例如更便宜的 glm-4.5,或更强的 glm-4.7) 才需要设
# LLM_PARENT_MODEL=glm-4.6
```

> ✅ **关于 prompt cache**：家长 app 默认用 **glm-4.6**, GLM 自动对相同前缀做 cache。
> 系统提示词约 35K tokens，每次对话都需要这部分。
> 第二次起 cache 命中时这部分降到 1/5 价格 — **对话越长,省的越多**。
>
> 如果想验证 cache 真的生效,看 Render 日志:
> - 第一次对话会看到 `[ParentLLM] ✗ cache miss: 35XXX prompt tokens (full price)`
> - 第二次起会看到 `[ParentLLM] ✓ cache hit: 32XXX/35XXX prompt tokens (94%)`
>
> 如果一直看到 cache miss,可能是 model 不对 (老的 glm-4-flash 不支持) 或者 base_url 不对。

### 第三步：部署

普通 `git push` → Render 自动重新部署即可。
首次启动后会看到日志：

```
LLM mode: healthy (glm-4-flash)
Parent app: model=glm-4.6, prompt=24KB loaded
```

如果看到 `prompt=NOT LOADED`，检查 `server/prompts/` 三个 md 文件是否被推上来了。

### 第四步：迁移已有家长账号

你之前注册的家长在数据库里的 `role` 是 `student`（这是默认值）。
他们没法直接进 `/parents`。你要做的：

**4.1 先列出已有"看起来像家长"的用户名**

登录数据库，或者用一个简单脚本：

```bash
# 在服务器上跑（或本地 + MONGODB_URI 环境变量）
mongosh "$MONGODB_URI" --eval "
  db.users.find({ role: 'student' }, { username: 1, displayName: 1, createdAt: 1 })
    .sort({ createdAt: -1 }).limit(50).pretty()
"
```

**4.2 跑迁移脚本（先干跑）**

```bash
node scripts/migrate_users_to_parent.js --dry-run wang_mom li_dad zhang_baba
```

会打印每个用户名当前的 role 和会被改成什么。**不改任何东西**。
确认无误后，去掉 `--dry-run`：

```bash
node scripts/migrate_users_to_parent.js wang_mom li_dad zhang_baba
```

**4.3 让被迁移的家长重新登录**

他们的 localStorage 里 `mc_user.role` 还是旧的 `student`。
让他们点"退出"再重新登录，新登录会拿到 `role: 'parent'` 然后自动跳到 `/parents`。

---

## 系统流程速览

### 家长视角

1. 注册时选「家长」 → role=parent → 自动到 `/parents`
2. 落地页看 10 张卡片，选最像自己情况的一张 → 自动启动一段对话
   - 或在底部"都不像？"框直接描述自己情况
3. 在 `/parents/chat.html?id=xxx` 页面和教练对话
4. 教练回答里如果命中触发词（"安排心理学专家"等）→ 顶部 banner 弹出
5. Banner 里点「留电话 →」 → 弹窗输入电话 → 进 `expert_requests` 表

### 后台员工视角

1. 用 `teacher` 帐号进 `/admin.html`
2. 顶部 tab 切「专家转介请求」（红色徽章显示未处理数量）
3. 左边列表按紧急度排序：紧急的（自伤等）在前，非紧急（家长主动要求）在后
4. 点一条 → 右边显示完整对话 + AI 摘要 + 联系电话
5. 联系完成后点「✓ 标记为已联系」+ 可加备注
6. 徽章数量自动减少（每分钟刷新一次）

---

## 关键技术细节

### 系统提示词

- 三个 md 文件在 `server/prompts/` 下
- `parent_llm.js` 启动时读一次拼成完整 prompt 缓存内存
- 总共约 23KB ≈ 35K tokens
- 每次对话以这 35K 作为 system 消息发送给 GLM

### 触发词检测

- LLM 给出回答后，`detectExpertFollowupTrigger()` 用 regex 检测两类触发词
- "我们后台工作人员会安排心理学专家**主动**联系" → severe
- "可以让我们后台工作人员安排..." → non_crisis
- 检测到就在 `expert_requests` 表里写一条记录

### 数据库 schema（新增）

```js
parentConversations: {
  userId, scenarioId, messages: [{role, content}], expertRequested
}
expertRequests: {
  userId, parentConversationId, urgency, status, parentPhone,
  conversationSummary, notes, createdAt, contactedAt
}
```

`users.role` enum 扩展了：`['student', 'parent', 'teacher']`。
旧用户保持 `student` 不变。

### 防重复

同一个家长会话只会创建一条 pending 的 expert request。
如果家长后续再触发，更新现有记录（升级 urgency / 补充电话）而不是新建。

---

## 监控建议

部署后这几件事要盯一下：

1. **Cache hit rate**（如果换了支持 cache 的 model）
   - 看服务器日志的 `[ParentLLM] Cache hit:` 行
   - 第一次对话会全量计费，第二次起应该看到 cached_tokens > 0
2. **专家转介请求堆积量**
   - 后台徽章红色数字 = 未联系的请求
   - 如果一直在涨说明响应速度跟不上
3. **Severe vs non_crisis 比例**
   - 太多 severe 可能说明触发词太宽
   - 太少 severe 可能说明 LLM 在该转介时没用上严重转介话术

---

## 排错速查

**家长登录后跳到 `/` 而不是 `/parents`**
→ 他的 `role` 还是 `student`。跑迁移脚本 + 让他重登。

**点卡片后报"启动失败"**
→ 看服务器日志。可能是 LLM_API_KEY 没设/失效。

**专家请求没记录**
→ 检查 LLM 回答是否真的包含了触发词。可以在 `parent_llm.js`
里临时加 console.log 看 LLM 回了啥。

**家长端响应特别慢（>10 秒）**
→ 第一次对话比较慢（35K prompt 全量计算）。从第二次起应该明显加快（cache 命中）。
   如果第二次还是慢,看日志是不是 cache miss。

**日志一直显示 `cache miss`，cache 没生效**
→ 可能 `LLM_PARENT_MODEL` 被覆盖成了不支持 cache 的模型 (例如 glm-4-flash)。
   查看 Render 启动日志 `Parent app: model=...` 那行确认实际用的什么 model。

**老学生账号变成家长后丢失了之前的对话历史**
→ 不会丢。`Conversation` 表的数据保留。但他在 `/parents` 看不到那些记录
（因为 parents app 用的是新表 `ParentConversation`）。
