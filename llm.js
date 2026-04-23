// llm.js - GLM (Zhipu AI) integration using OpenAI-compatible SDK
// GLM 的 OpenAI 兼容接口，通过设置 baseURL 指向智谱的 endpoint

const OpenAI = require('openai');

// ---- Configuration (via env vars) --------------------------------------
// LLM_API_KEY   : 你的 GLM API key（来自 https://open.bigmodel.cn/）
// LLM_BASE_URL  : 默认 https://open.bigmodel.cn/api/paas/v4（国内）
//                 国际用户可用 https://api.z.ai/api/paas/v4
// LLM_MODEL     : 默认 glm-4-flash（便宜、快）；可改为 glm-4-plus 等
//
// 为了兼容老的 .env，OPENAI_API_KEY / OPENAI_MODEL 仍然作为 fallback。
// ------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const DEFAULT_MODEL = 'GLM-4.7-FlashX';

function getApiKey() {
  return (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '').trim();
}

function getBaseUrl() {
  return (process.env.LLM_BASE_URL || DEFAULT_BASE_URL).trim();
}

function getModel() {
  return (process.env.LLM_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL).trim();
}

let client = null;
let llmHealth = {
  configured: false,
  healthy: false,
  checkedAt: null,
  model: getModel(),
  provider: 'GLM',
  baseUrl: getBaseUrl(),
  error: null,
  keyPreview: null
};

function hasApiKey() {
  return Boolean(getApiKey());
}

function getKeyPreview() {
  const key = getApiKey();
  if (!key) return null;
  if (key.length <= 16) return `${key.slice(0, 4)}...${key.slice(-2)}`;
  return `${key.slice(0, 10)}...${key.slice(-6)}`;
}

function getClient() {
  if (!hasApiKey()) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: getApiKey(),
      baseURL: getBaseUrl()
    });
  }
  return client;
}

async function checkLlmHealth(force = false) {
  llmHealth.configured = hasApiKey();
  llmHealth.keyPreview = getKeyPreview();
  llmHealth.model = getModel();
  llmHealth.baseUrl = getBaseUrl();
  llmHealth.provider = 'GLM';

  if (!llmHealth.configured) {
    llmHealth.healthy = false;
    llmHealth.error = 'No LLM_API_KEY found';
    llmHealth.checkedAt = Date.now();
    return llmHealth;
  }

  if (!force && llmHealth.checkedAt && llmHealth.healthy) {
    return llmHealth;
  }

  try {
    const openai = getClient();
    // GLM's OpenAI-compatible endpoint uses chat.completions
    const resp = await openai.chat.completions.create({
      model: llmHealth.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5
    });
    const ok = Boolean(resp?.choices?.[0]?.message);
    llmHealth.healthy = ok;
    llmHealth.error = ok ? null : 'Empty response from LLM';
    llmHealth.checkedAt = Date.now();
    return llmHealth;
  } catch (err) {
    llmHealth.healthy = false;
    llmHealth.error = err?.message || 'Unknown LLM health error';
    llmHealth.checkedAt = Date.now();
    return llmHealth;
  }
}

function getLlmHealth() {
  return { ...llmHealth };
}

async function generateCoachReply({ systemPrompt, userMessage, context }) {
  const openai = getClient();
  if (!openai) return null;

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Context:\n${JSON.stringify(context, null, 2)}\n\nStudent message:\n${userMessage}`
        }
      ],
      temperature: 0.6,
      max_tokens: 800
    });

    const text = response?.choices?.[0]?.message?.content || '';
    return text.trim() || null;
  } catch (err) {
    console.error('[LLM] generateCoachReply error:', err?.message || err);
    return null;
  }
}

// ============================================================
// 复盘：基于金洪源元认知心理干预技术生成结构化复盘
// 返回：知识点定位 + S-E-R 链条 + CER 程序识别 + 元认知训练任务
// ============================================================
async function generateMetacognitiveSummary({ questionText, messages, events, state, isExam = false }) {
  const openai = getClient();
  if (!openai) return null;

  const systemPrompt = `你是一位熟悉金洪源教授《元认知心理干预技术》的学习诊断专家。你的任务是复盘一次中学生数学做题过程，输出严格的 JSON 结构。

核心理论依据：
1. 学生在做题中遇到困难时，会自动启动"条件性情绪反应(CER)程序"——即 S(刺激情境) → E(自动情绪) → R(思维/行为反应) 的自动链条。
2. 学生遇到困难时的卡点，可能是"知识性问题"（不会、夹生），也可能是"元认知性问题"（CER 程序在作怪）。这两类必须分开诊断，因为解法完全不同。
3. 元认知干预不是讲道理、不是鼓励，而是帮学生"看见自己的程序"并给出可执行的觉察训练任务。

你必须严格输出以下 JSON（不要任何 markdown 代码块包裹，直接输出 JSON 对象）：
{
  "knowledgeDiagnosis": {
    "gaps": ["学生明显不会的知识点（空白），每条一句话"],
    "fuzzy": ["学生似乎记得但用不熟的知识点（夹生/欠缺）"],
    "mastered": ["本题中明确表现出已掌握的知识点"]
  },
  "serChain": {
    "triggered": true 或 false,
    "S": "具体触发情境，要引用学生在哪一轮、遇到什么步骤。如果未触发则为空字符串",
    "E": "学生出现的自动情绪反应（用学生原话 + 情绪类型标注，如'自我否定型''焦虑型''回避型'）",
    "R": "学生接下来的思维/行为反应（如：放弃尝试、转向要答案、重复错误、沉默等）",
    "cerType": "识别出的 CER 程序类型：'自我否定型' | '回避型' | '急躁型' | '启动困难型' | '完美主义型' | '无明显CER'",
    "description": "一段话解释这个程序是怎么在本次会话中跑起来的，面向学生本人"
  },
  "rootCause": "一句话说清本次的真正卡点：是'知识空白'、'知识夹生'，还是'CER 程序接管了决策'，还是两者叠加",
  "metacognitiveTraining": {
    "task": "一个具体、可操作的元认知觉察训练任务，针对本次识别出的 CER 类型定制。不要讲道理，不要鼓励。要像行为指令一样可执行。",
    "whenToUse": "下次什么情境下启动这个训练",
    "rationale": "为什么这个训练对本次的 CER 程序有效（1-2 句话）"
  },
  "studentFacing": {
    "whatHappened": "面向学生的 2-3 句话，说清这次发生了什么。不用术语，不说'CER''元认知'。",
    "oneThingToSee": "下次训练时只需要看见的一件事"
  }
}

要求：
- 所有文字用中文，面向学生的部分语气要温和、具体、不教条。
- 不要在任何字段（包括 serChain.description, metacognitiveTraining, rootCause, studentFacing 等）中使用以下术语："元认知""CER""条件性情绪反应""metacognitive""潜意识程序""心理干预"。cerType 字段只能在 "自我否定型/回避型/急躁型/启动困难型/完美主义型/无明显CER" 这几个标签里选，不得展开解释这些术语。
- 描述程序时用日常语言，例如"一遇到变形步骤就想放弃""心里一急就说自己笨"等，不要使用心理学术语。
- 如果对话内容不足以诊断（如消息太少），也要尽量基于已有信息给出判断，不要输出"信息不足"。
- 知识点要具体到题目中的概念（如"二次函数配方法""根的判别式"），不要笼统说"代数"。`;

  const convoText = messages.map((m, i) => {
    const role = m.role === 'user' ? '学生' : '教练';
    return `[第${i + 1}轮·${role}·${m.type || ''}] ${m.content}`;
  }).join('\n');

  const eventText = (events || []).map((e, i) => `${i + 1}. ${e.type}: ${e.note || ''}`).join('\n') || '（无关键事件记录）';

  const userMessage = `题目：
${questionText || '（未提供题目文本）'}

完整对话记录：
${convoText || '（无对话）'}

系统识别的关键事件序列：
${eventText}

学生状态快照：
- 用时：${state.timeSpentSec} 秒
- 提示层级：${state.hintLevel}
- 连续无推进轮数：${state.noProgressTurns}
- 情绪波动次数：${state.emotionCycles}
- 要答案次数：${state.answerRequestCount}
- 回避次数：${state.withdrawalCount}
${isExam ? `
⚠️ 重要背景：本次是考试模式。教练全程没有介入，没有给任何提示，学生是在独立、类似真实考场的压力下作答。
- 这意味着学生展现出的反应（卡点、情绪、回避、放弃、要答案的倾向等）就是他在真实考场里的自动反应。
- 复盘时请在 studentFacing.whatHappened 中点明这一点：这次看到的是"没人帮你时你会怎么做"，这正是最真实的自己。
- metacognitiveTraining 要针对"下次真实考场遇到同样触发时"如何做出不同反应。
- 如果学生提交了最终答案（会出现在对话最后一条【提交答案】里），评估时可以结合答案正确性和过程推理的一致性。` : ''}

请严格按 JSON schema 输出复盘结果。`;

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 1800,
      response_format: { type: 'json_object' }
    });

    const text = response?.choices?.[0]?.message?.content || '';
    if (!text) return null;

    // Clean up any markdown fences just in case
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[LLM] generateMetacognitiveSummary JSON parse error:', parseErr.message, 'raw:', cleaned.slice(0, 300));
      return null;
    }
  } catch (err) {
    console.error('[LLM] generateMetacognitiveSummary error:', err?.message || err);
    return null;
  }
}

// ============================================================
// 错题手术：打磨单个步骤（Step 1 定位病灶 / Step 2 寻找线索 / Step 3 写下炒菜程序）
// 教练式反馈：不是改写，而是指出是否"够具体""够可操作"，并给出一个更精准的改写建议
// ============================================================
async function generateSurgeryStepFeedback({ stepNumber, stepName, stepContent, questionText, priorSteps = {} }) {
  const openai = getClient();
  if (!openai) return null;

  const stepGuidance = {
    1: {
      name: '定位病灶',
      goodExample: '"不是我粗心，而是我没想到要在这里加辅助线构造全等三角形。"',
      badExample: '"我粗心了。" / "这题我不熟。" / "计算错了。"',
      criteria: '必须具体到某个"知识点/公式/辅助线/推理步骤"——不能只说"粗心"或"不熟"。错因应是一个可命名的概念性盲点。'
    },
    2: {
      name: '寻找线索',
      goodExample: '"看到题目里有\'中点\'两个字，就应该触发\'倍长中线\'这个思路。"',
      badExample: '"这题就该用这个方法。" / "看完题目就知道。"',
      criteria: '必须定位到题目中某个具体的"词/条件/图形特征"——这个词就是未来的触发器。不能笼统地说"看到这类题"。'
    },
    3: {
      name: '写下炒菜程序',
      goodExample: '"以后看到\'中点 + 线段倍数关系\'，直接倍长中线构造全等。"',
      badExample: '"以后要认真审题。" / "多做类似题。"',
      criteria: '必须是"如果 [具体触发条件]，就 [具体动作]"的句式。触发条件要精确到关键词，动作要精确到一步可执行的方法。不能是空洞的提醒。'
    }
  };

  const g = stepGuidance[stepNumber] || stepGuidance[1];

  const systemPrompt = `你是一位熟悉金洪源《元认知心理干预技术》的学习教练。你正在帮一位中学生做"错题微型手术"——把一道错题变成一条可执行的"炒菜程序"。

当前是第 ${stepNumber} 步：${g.name}
好的例子：${g.goodExample}
不够好的例子：${g.badExample}
评判标准：${g.criteria}

你的任务：
- 读学生写的这一步，判断是否足够具体、可操作。
- 如果足够好，直接给肯定并说出"好在哪"（一句话）。
- 如果不够好，指出"哪里还模糊"（一句话），并给出一个更精准的改写建议（一句话）。
- 不讲大道理，不夸张地鼓励，像一个真的在旁边带学生的数学老师。
- 全程中文，输出不超过 3 句话。

严格输出 JSON（不要 markdown 代码块）：
{
  "verdict": "good" | "needs_work",
  "comment": "一句话判断：好在哪 / 哪里还模糊",
  "suggestion": "如果 needs_work，给出一个更精准的改写建议；如果 good，可以给空字符串"
}`;

  const priorContext = [];
  if (priorSteps.step1) priorContext.push(`第1步（定位病灶）：${priorSteps.step1}`);
  if (priorSteps.step2) priorContext.push(`第2步（寻找线索）：${priorSteps.step2}`);

  const userMessage = `错题：
${questionText || '（学生未填写题目）'}

${priorContext.length ? '已完成的步骤：\n' + priorContext.join('\n') + '\n\n' : ''}学生写的第 ${stepNumber} 步（${g.name}）：
"${stepContent}"

请按 JSON schema 输出你的判断。`;

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 400,
      response_format: { type: 'json_object' }
    });

    const text = response?.choices?.[0]?.message?.content || '';
    if (!text) return null;
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('[LLM] generateSurgeryStepFeedback JSON parse error:', e.message, 'raw:', cleaned.slice(0, 300));
      return null;
    }
  } catch (err) {
    console.error('[LLM] generateSurgeryStepFeedback error:', err?.message || err);
    return null;
  }
}

// ============================================================
// 错题手术：生成最终的"炒菜程序卡"
// 输入学生写的三步，输出一张结构化、可收藏的错题手术卡
// ============================================================
async function generateSurgeryCard({ questionText, step1, step2, step3 }) {
  const openai = getClient();
  if (!openai) return null;

  const systemPrompt = `你是一位熟悉金洪源《元认知心理干预技术》的学习教练。学生刚做完一道错题的"微型手术"，写完了三步：
第一步（定位病灶）：这道题错在哪个具体的概念/公式？
第二步（寻找线索）：题目中哪个词/条件本来应该触发这个公式？
第三步（写下炒菜程序）：总结成"如果…就…"的口诀？

你的任务是把学生写的原始三步，加工成一张清晰、可收藏、可在下次考试时直接调用的"错题手术卡"。

要点：
- 保留学生的核心洞察，不要替换成你自己的理解。
- 如果学生写得模糊，你要把它"抛光"到更具体、更可执行的程度，但不要扭曲原意。
- 口诀一定要是标准的"如果 [触发条件]，就 [动作]"句式。
- 触发词要精确到题目里会出现的原始字眼（如"中点""直角""对称""最值""整数解"等）。
- 动作要精确到一步具体的数学操作（如"倍长中线""设未知数列方程""分类讨论"等）。
- 给这张卡一个简短的标题（不超过12字），方便学生在错题本里翻找。
- 给这张卡打一个知识点标签（如"全等三角形-辅助线""二次函数-最值""因式分解-十字相乘"），方便归类。
- 加一句"升华"——用一句话说清这张卡背后的思维习惯，像盖章一样。不要长篇大论。

严格输出 JSON（不要 markdown 代码块）：
{
  "title": "不超过12字的卡片标题",
  "knowledgeTag": "知识点标签，形如'章节-知识点'",
  "lesion": "抛光后的第一步：具体到概念/公式/辅助线的错因",
  "trigger": "抛光后的第二步：题目中应当触发正确思路的那个关键词或条件",
  "recipe": "抛光后的第三步：标准的'如果 X，就 Y'口诀",
  "insight": "一句话升华：这张卡背后的思维习惯",
  "qualityScore": 1 到 5 的整数（打磨后这张卡的可用性评分）,
  "qualityComment": "一句话说明为什么打这个分——学生做得好的地方 + 下次可以更好的地方"
}

要求：
- 全程中文。
- 不要使用"元认知""CER""条件性情绪反应"等心理学术语。
- insight 要像一句可以贴在课桌上的话，不要说教。
- 如果学生某一步写得极其空洞（比如只写了"粗心"），在抛光时要尽量利用题目信息补出一个更具体的版本，并在 qualityComment 里诚实指出"原文较模糊，以下版本为教练根据题目补出的参考"。`;

  const userMessage = `错题原文：
${questionText || '（学生未填写题目）'}

学生写的三步：
【第一步·定位病灶】${step1 || '（空）'}
【第二步·寻找线索】${step2 || '（空）'}
【第三步·炒菜程序】${step3 || '（空）'}

请按 JSON schema 输出这张错题手术卡。`;

  try {
    const response = await openai.chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    });

    const text = response?.choices?.[0]?.message?.content || '';
    if (!text) return null;
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      console.error('[LLM] generateSurgeryCard JSON parse error:', e.message, 'raw:', cleaned.slice(0, 300));
      return null;
    }
  } catch (err) {
    console.error('[LLM] generateSurgeryCard error:', err?.message || err);
    return null;
  }
}

module.exports = {
  hasApiKey,
  checkLlmHealth,
  getLlmHealth,
  generateCoachReply,
  generateMetacognitiveSummary,
  generateSurgeryStepFeedback,
  generateSurgeryCard
};
