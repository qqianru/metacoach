let sessionId = null;
let sessionMode = 'practice';
let examSubmitted = false;
let surgeryFinalized = false;
let appUser = null;
try { appUser = JSON.parse(localStorage.getItem('mc_user')); } catch {}

function getUserId() {
  return appUser ? appUser.id : 'guest';
}

const els = {
  modeSelect: document.getElementById('modeSelect'),
  questionInput: document.getElementById('questionInput'),
  newSessionBtn: document.getElementById('newSessionBtn'),
  loadSummaryBtn: document.getElementById('loadSummaryBtn'),
  stateView: document.getElementById('stateView'),
  chatLog: document.getElementById('chatLog'),
  userInput: document.getElementById('userInput'),
  deltaInput: document.getElementById('deltaInput'),
  markErrorInput: document.getElementById('markErrorInput'),
  sendBtn: document.getElementById('sendBtn'),
  summaryPanel: document.getElementById('summaryPanel'),
  summaryContent: document.getElementById('summaryContent'),
  llmBadge: document.getElementById('llmBadge'),
  // ---- surgery mode ----
  practicePanel: document.getElementById('practicePanel'),
  surgeryPanel: document.getElementById('surgeryPanel'),
  surgeryQuestionInput: document.getElementById('surgeryQuestionInput'),
  surgeryStep1Input: document.getElementById('surgeryStep1Input'),
  surgeryStep2Input: document.getElementById('surgeryStep2Input'),
  surgeryStep3Input: document.getElementById('surgeryStep3Input'),
  surgeryFinalizeBtn: document.getElementById('surgeryFinalizeBtn'),
  newSurgeryBtn: document.getElementById('newSurgeryBtn'),
  loadSurgeryCardBtn: document.getElementById('loadSurgeryCardBtn')
};

function setLlmBadge(health) {
  if (!els.llmBadge) return;
  if (!health || !health.configured) {
    els.llmBadge.textContent = 'LLM: fallback';
    els.llmBadge.className = 'llm-badge warn';
    return;
  }
  if (health.healthy) {
    els.llmBadge.textContent = `LLM: healthy · ${health.model || 'model'}`;
    els.llmBadge.className = 'llm-badge ok';
    return;
  }
  els.llmBadge.textContent = 'LLM: fallback (key/config issue)';
  els.llmBadge.className = 'llm-badge warn';
}

async function checkLlmHealth(force = false) {
  try {
    const res = await fetch(`/api/llm-health${force ? '?force=1' : ''}`);
    const data = await res.json();
    setLlmBadge(data);
  } catch {
    setLlmBadge(null);
  }
}

function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function addMessage(role, content, type = '') {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${role === 'user' ? '学生' : '王鹰教授'}${type ? ' · ' + type : ''}`;
  const body = document.createElement('div');
  body.textContent = content;
  body.style.whiteSpace = 'pre-wrap';
  bubble.appendChild(meta);
  bubble.appendChild(body);
  div.appendChild(bubble);
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function renderState(state) {
  if (!state) return;
  els.stateView.innerHTML = `
    <div>会话：${sessionId || '未开始'}</div>
    <div>模式：${state.mode}</div>
    <div>对话状态：${state.conversationMode || 'SOLVING'}</div>
    <div>用时：${state.timeSpentSec} 秒</div>
    <div>提示层级：${state.hintLevel}</div>
    <div>情绪风险：${state.emotionRisk}</div>
    <div>题目难度：${state.questionDifficulty}</div>
    <div>最近状态：${state.lastStateType || 'NORMAL'}</div>
    <div>建议跳题：${state.shouldOfferSkip ? '是' : '否'}</div>
  `;
}

// Switch left panel depending on mode
function applyModeUi(mode) {
  const isSurgery = mode === 'micro_surgery';
  if (els.practicePanel) els.practicePanel.style.display = isSurgery ? 'none' : '';
  if (els.surgeryPanel) els.surgeryPanel.style.display = isSurgery ? '' : 'none';

  // Update the practice/exam intro card to match the current mode.
  // (Surgery has its own intro paragraph, no swap needed.)
  const introEl = document.getElementById('practiceIntro');
  if (introEl) {
    if (mode === 'exam') {
      introEl.innerHTML =
        '<div class="mode-intro-title">📝 考试模式 · 教练全程不说话</div>' +
        '<div class="mode-intro-body">' +
          '想测一下自己真实水平？这个模式我会闭嘴，只看着你做。' +
          '<ol>' +
            '<li>在下面的"题目"框里贴一道题。</li>' +
            '<li>点"开始陪练这道题"，开始独立作答。中间不会有任何提示。</li>' +
            '<li>做完后点"提交答案"，我才会出现，帮你复盘哪几步走得稳、哪几步差点翻车。</li>' +
          '</ol>' +
        '</div>';
    } else {
      // practice (default)
      introEl.innerHTML =
        '<div class="mode-intro-title">📘 练一题 · 教练陪你做一道题</div>' +
        '<div class="mode-intro-body">' +
          '这个软件用起来很简单：' +
          '<ol>' +
            '<li>在下面的"题目"框里粘贴一道你的题（已经预填了一道示例题，可以直接试）。</li>' +
            '<li>点"开始陪练这道题"按钮，开始和我对话。</li>' +
            '<li>我会通过提问帮你找到答案 —— 不会直接给答案。</li>' +
          '</ol>' +
          '卡住了也可以直接说"我卡住了"，我会帮你。' +
        '</div>';
    }
  }

  updateExamUi();
}

async function createSession() {
  const mode = els.modeSelect.value;
  const res = await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, userId: getUserId() })
  });
  const data = await res.json();
  sessionId = data.sessionId;
  sessionMode = mode;
  examSubmitted = false;
  surgeryFinalized = false;
  els.chatLog.innerHTML = '';
  els.summaryPanel.hidden = true;

  // Show quick-action buttons now that a session is active
  const quickActionsCard = document.getElementById('quickActionsCard');
  if (quickActionsCard) quickActionsCard.style.display = '';
  // Hide the example hint (no longer needed)
  const exampleHint = document.getElementById('exampleHint');
  if (exampleHint) exampleHint.style.display = 'none';
  setLlmBadge(data.llmHealth);
  applyModeUi(mode);

  // Reset surgery fields if starting a surgery session
  if (mode === 'micro_surgery') {
    if (els.surgeryQuestionInput) els.surgeryQuestionInput.value = '';
    if (els.surgeryStep1Input) els.surgeryStep1Input.value = '';
    if (els.surgeryStep2Input) els.surgeryStep2Input.value = '';
    if (els.surgeryStep3Input) els.surgeryStep3Input.value = '';
    ['surgeryFeedback1', 'surgeryFeedback2', 'surgeryFeedback3'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  }

  let openingMsg = getModeOpeningMessage(mode);
  addMessage('assistant', openingMsg, 'SYSTEM');

  renderState({
    mode,
    conversationMode: 'SOLVING',
    timeSpentSec: 0,
    hintLevel: 0,
    emotionRisk: 'low',
    questionDifficulty: 'medium',
    shouldOfferSkip: false,
    lastStateType: 'NORMAL'
  });
}

function updateExamUi() {
  const submitBtn = document.getElementById('submitExamBtn');
  const loadBtn = els.loadSummaryBtn;
  const banner = document.getElementById('examBanner');
  if (sessionMode === 'exam' && !examSubmitted) {
    if (submitBtn) submitBtn.style.display = '';
    if (loadBtn) loadBtn.disabled = true;
    if (banner) banner.style.display = '';
  } else {
    if (submitBtn) submitBtn.style.display = 'none';
    if (loadBtn) loadBtn.disabled = false;
    if (banner) banner.style.display = 'none';
  }
}

async function submitExam() {
  if (!sessionId) return alert('还没有开始考试。');
  if (examSubmitted) return;
  const finalAnswer = prompt('请输入你的最终答案（可留空）：', '') || '';
  if (!confirm('确定要提交吗？提交后教练会开始生成复盘，过程不可撤销。')) return;
  const res = await fetch(`/api/session/${sessionId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalAnswer })
  });
  const data = await res.json();
  if (data.error) return alert(data.error);
  examSubmitted = true;
  addMessage('user', `【提交答案】${finalAnswer || '（未填写）'}`, 'EXAM_SUBMIT');
  addMessage('assistant', '答案已提交。你可以点击"查看复盘"看看刚才的表现。', 'SYSTEM');
  updateExamUi();
}

// 流式版本: 创建一个空的 assistant 气泡, 一边接 token 一边往里写
function addStreamingMessage(metaLabel) {
  const div = document.createElement('div');
  div.className = 'message assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble streaming';
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = metaLabel || '王鹰教授';
  const body = document.createElement('div');
  body.style.whiteSpace = 'pre-wrap';
  // 初始显示动画点
  body.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  bubble.appendChild(meta);
  bubble.appendChild(body);
  div.appendChild(bubble);
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
  return { bubble, body, meta };
}

function appendStreamingText(refs, text, isFinal = false) {
  // refs: { bubble, body, meta }
  refs.body.textContent = text;
  if (!isFinal) {
    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';
    cursor.textContent = '▍';
    refs.body.appendChild(cursor);
  }
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function finalizeStreamingMessage(refs, finalContent, type) {
  refs.body.textContent = finalContent;
  refs.bubble.classList.remove('streaming');
  if (type) {
    refs.meta.textContent = `王鹰教授 · ${type}`;
  }
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

async function sendMessage(prefilled = null) {
  if (!sessionId) {
    await createSession();
  }
  const userInput = prefilled || els.userInput.value.trim();
  const questionText = els.questionInput ? els.questionInput.value.trim() : '';
  if (!userInput) return;

  addMessage('user', userInput);
  els.userInput.value = '';

  // 创建空气泡 + 显示等待动画
  const refs = addStreamingMessage('王鹰教授');
  let accumulated = '';
  let finalState = null;
  let finalReplyType = '';

  try {
    const resp = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        questionText,
        userInput,
        deltaSec: Number(els.deltaInput.value || 20),
        markError: els.markErrorInput.checked,
        userId: getUserId()
      })
    });

    if (!resp.ok) {
      // 非 200, 比如 429 daily limit. body 是 JSON
      const errBody = await resp.json().catch(() => ({}));
      finalizeStreamingMessage(refs, '(' + (errBody.message || errBody.error || '请求失败') + ')', 'ERROR');
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const events = sseBuffer.split('\n\n');
      sseBuffer = events.pop();

      for (const ev of events) {
        if (!ev.trim()) continue;
        let eventName = 'message';
        let dataStr = '';
        for (const line of ev.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
        }
        if (!dataStr) continue;
        let data;
        try { data = JSON.parse(dataStr); } catch { continue; }

        if (eventName === 'token') {
          accumulated += data.delta || '';
          appendStreamingText(refs, accumulated);
        } else if (eventName === 'full_reply') {
          // 非流式 reply (硬编码 / 缓存命中) — 一次性塞进去
          accumulated = data.reply?.content || '';
          finalReplyType = data.reply?.type || '';
          appendStreamingText(refs, accumulated);
        } else if (eventName === 'error') {
          accumulated = (accumulated || '') + '\n\n(' + (data.error || '出错') + ')';
          appendStreamingText(refs, accumulated);
        } else if (eventName === 'done') {
          finalState = data.state;
          if (data.reply && data.reply.type) finalReplyType = data.reply.type;
          if (data.reply && data.reply.content && !accumulated) accumulated = data.reply.content;
        }
      }
    }
    finalizeStreamingMessage(refs, accumulated || '(没有回复)', finalReplyType);
    if (finalState) renderState(finalState);
  } catch (e) {
    console.error('stream error:', e);
    finalizeStreamingMessage(refs, '(网络错误,请稍后再试)', 'ERROR');
  } finally {
    els.markErrorInput.checked = false;
  }
}

async function loadSummary() {
  if (!sessionId) {
    alert('请先开始新会话，再查看复盘。');
    return;
  }
  if (sessionMode === 'exam' && !examSubmitted) {
    alert('考试还没结束，请先提交答案再查看复盘。');
    return;
  }
  els.summaryPanel.hidden = false;
  els.summaryContent.innerHTML = '<p style="color:var(--muted);padding:20px;text-align:center;">正在生成复盘，请稍候…</p>';
  els.summaryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const res = await fetch(`/api/session/${sessionId}/summary`);
  const data = await res.json();
  if (data.error) {
    els.summaryContent.innerHTML = `<p style="color:#b91c1c;padding:20px;">${esc(data.message || data.error)}</p>`;
    return;
  }

  // If this is a surgery summary, render the card layout
  if (data.mode === 'micro_surgery' || data.surgeryCard) {
    els.summaryContent.innerHTML = renderSurgeryCardHtml(data);
    return;
  }

  renderStandardSummary(data);
}

function list(arr, empty = '暂无') {
  if (!arr || arr.length === 0) return `<li style="color:var(--muted);">${empty}</li>`;
  return arr.map((s) => `<li>${esc(s)}</li>`).join('');
}

function renderStandardSummary(data) {
  let html = '';

  // ---- 1. 学生视角 ----
  if (data.studentFacing) {
    html += `
      <div class="summary-section student-facing">
        <h3>📝 这次发生了什么</h3>
        <p>${esc(data.studentFacing.whatHappened)}</p>
        ${data.studentFacing.oneThingToSee ? `<p class="one-thing"><strong>下次只需要看见这一件事：</strong>${esc(data.studentFacing.oneThingToSee)}</p>` : ''}
      </div>
    `;
  } else {
    html += `
      <div class="summary-section">
        <h3>📝 这次发生了什么</h3>
        <p>${esc(data.whatHappened || '暂无明显问题。')}</p>
      </div>
    `;
  }

  // ---- 2. 知识点诊断 ----
  if (data.knowledgeDiagnosis) {
    const kd = data.knowledgeDiagnosis;
    html += `
      <div class="summary-section knowledge-diag">
        <h3>📚 知识点定位</h3>
        <div class="kd-grid">
          <div class="kd-card kd-gap">
            <div class="kd-label">知识空白（不会）</div>
            <ul>${list(kd.gaps, '未发现明显空白')}</ul>
          </div>
          <div class="kd-card kd-fuzzy">
            <div class="kd-label">知识夹生（记得但用不熟）</div>
            <ul>${list(kd.fuzzy, '未发现明显夹生点')}</ul>
          </div>
          <div class="kd-card kd-mastered">
            <div class="kd-label">已掌握</div>
            <ul>${list(kd.mastered, '本题未明显体现')}</ul>
          </div>
        </div>
      </div>
    `;
  }

  // ---- 3. S-E-R 链条 ----
  if (data.serChain && data.serChain.triggered) {
    const s = data.serChain;
    html += `
      <div class="summary-section ser-chain">
        <h3>🔗 程序轨迹（S → E → R）</h3>
        ${s.cerType && s.cerType !== '无明显CER' ? `<div class="cer-badge">识别到的程序类型：<strong>${esc(s.cerType)}</strong></div>` : ''}
        <div class="ser-flow">
          <div class="ser-node ser-s">
            <div class="ser-tag">S · 触发情境</div>
            <div class="ser-text">${esc(s.S || '—')}</div>
          </div>
          <div class="ser-arrow">→</div>
          <div class="ser-node ser-e">
            <div class="ser-tag">E · 自动情绪</div>
            <div class="ser-text">${esc(s.E || '—')}</div>
          </div>
          <div class="ser-arrow">→</div>
          <div class="ser-node ser-r">
            <div class="ser-tag">R · 行为反应</div>
            <div class="ser-text">${esc(s.R || '—')}</div>
          </div>
        </div>
        ${s.description ? `<p class="ser-desc">${esc(s.description)}</p>` : ''}
      </div>
    `;
  } else if (data.serChain && !data.serChain.triggered) {
    html += `
      <div class="summary-section">
        <h3>🔗 程序轨迹</h3>
        <p style="color:var(--muted);">本次没有明显的自动化情绪-行为程序被触发，整体推进比较平稳。</p>
      </div>
    `;
  }

  // ---- 4. 真正的卡点 ----
  if (data.rootCause) {
    html += `
      <div class="summary-section root-cause">
        <h3>🎯 真正的卡点</h3>
        <p><strong>${esc(data.rootCause)}</strong></p>
      </div>
    `;
  }

  // ---- 5. 下次的训练任务 ----
  if (data.metacognitiveTraining) {
    const mt = data.metacognitiveTraining;
    html += `
      <div class="summary-section training-task">
        <h3>🧠 下次的训练</h3>
        <div class="training-card">
          <div class="training-task-text">${esc(mt.task)}</div>
          ${mt.whenToUse ? `<div class="training-when"><strong>什么时候用：</strong>${esc(mt.whenToUse)}</div>` : ''}
          ${mt.rationale ? `<div class="training-why"><strong>为什么有用：</strong>${esc(mt.rationale)}</div>` : ''}
        </div>
      </div>
    `;
  } else if (data.nextAction) {
    html += `
      <div class="summary-section">
        <h3>🧠 下次只改一件事</h3>
        <p>${esc(data.nextAction)}</p>
      </div>
    `;
  }

  // ---- 6. 基础数据 ----
  html += `
    <details class="summary-meta">
      <summary>基础数据</summary>
      <div class="summary-grid">
        <div class="summary-card"><strong>总消息数</strong><span>${data.totalMessages}</span></div>
        <div class="summary-card"><strong>总用时</strong><span>${data.timeSpentSec} 秒</span></div>
        <div class="summary-card"><strong>提示层级</strong><span>${data.hintLevel}</span></div>
        <div class="summary-card"><strong>复盘来源</strong><span>${data.llmSummary ? 'AI 深度诊断' : '规则引擎'}</span></div>
      </div>
    </details>
  `;

  els.summaryContent.innerHTML = html;
}

function renderSurgeryCardHtml(data) {
  const card = data.surgeryCard || {};
  const steps = data.steps || {};
  const qs = Math.max(1, Math.min(5, Number(card.qualityScore || 3)));
  const stars = '★'.repeat(qs) + '☆'.repeat(5 - qs);

  let html = `
    <div class="surgery-card">
      <div class="surgery-card-header">
        <div class="surgery-card-title">${esc(card.title || '错题手术卡')}</div>
        <div class="surgery-card-tag">${esc(card.knowledgeTag || '未分类')}</div>
      </div>
      <div class="surgery-card-body">
        <div class="surgery-card-row">
          <div class="surgery-card-row-label">🔎 病灶</div>
          <div class="surgery-card-row-value">${esc(card.lesion || steps.step1 || '')}</div>
        </div>
        <div class="surgery-card-row">
          <div class="surgery-card-row-label">🧲 触发词</div>
          <div class="surgery-card-row-value">${esc(card.trigger || steps.step2 || '')}</div>
        </div>
        <div class="surgery-card-row recipe">
          <div class="surgery-card-row-label">🍳 炒菜程序</div>
          <div class="surgery-card-row-value"><strong>${esc(card.recipe || steps.step3 || '')}</strong></div>
        </div>
        ${card.insight ? `<div class="surgery-card-insight">💡 ${esc(card.insight)}</div>` : ''}
      </div>
      <div class="surgery-card-footer">
        <div class="surgery-quality">
          <span class="surgery-stars">${stars}</span>
          <span class="surgery-quality-score">${qs} / 5</span>
        </div>
        ${card.qualityComment ? `<div class="surgery-quality-comment">${esc(card.qualityComment)}</div>` : ''}
      </div>
    </div>
    <details class="summary-meta">
      <summary>查看你原始写的三步</summary>
      <div class="surgery-raw">
        <div class="surgery-raw-row"><strong>第一步·定位病灶：</strong>${esc(steps.step1 || '')}</div>
        <div class="surgery-raw-row"><strong>第二步·寻找线索：</strong>${esc(steps.step2 || '')}</div>
        <div class="surgery-raw-row"><strong>第三步·炒菜程序：</strong>${esc(steps.step3 || '')}</div>
      </div>
    </details>
  `;
  return html;
}

// ---- Surgery step feedback ----
async function refineSurgeryStep(stepNumber) {
  if (!sessionId) {
    await createSession();
  }
  const input = document.getElementById(`surgeryStep${stepNumber}Input`);
  const stepContent = input ? input.value.trim() : '';
  if (!stepContent) {
    alert('请先写点内容，再让教练打磨。');
    return;
  }
  const feedbackEl = document.getElementById(`surgeryFeedback${stepNumber}`);
  if (feedbackEl) {
    feedbackEl.innerHTML = '<div class="surgery-feedback-loading">教练正在看你的第 ' + stepNumber + ' 步…</div>';
  }

  const questionText = els.surgeryQuestionInput ? els.surgeryQuestionInput.value.trim() : '';

  try {
    const res = await fetch(`/api/session/${sessionId}/surgery/step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepNumber,
        stepContent,
        questionText,
        wantFeedback: true
      })
    });
    const data = await res.json();
    if (data.error) {
      if (feedbackEl) feedbackEl.innerHTML = `<div class="surgery-feedback-card needs-work">${esc(data.error)}</div>`;
      return;
    }
    renderSurgeryFeedback(stepNumber, data.feedback);
    // Also append to chat log
    addMessage('user', `【第${stepNumber}步】${stepContent}`, `SURGERY_STEP_${stepNumber}`);
    if (data.feedback) {
      const tag = data.feedback.verdict === 'good' ? '✅' : '✏️';
      const body = data.feedback.verdict === 'good'
        ? `${tag} ${data.feedback.comment || '这一步写得够具体。'}`
        : `${tag} ${data.feedback.comment || '这一步可以更具体。'}${data.feedback.suggestion ? `\n建议改为：${data.feedback.suggestion}` : ''}`;
      addMessage('assistant', body, `SURGERY_FEEDBACK_${stepNumber}`);
    }
  } catch (err) {
    if (feedbackEl) feedbackEl.innerHTML = `<div class="surgery-feedback-card needs-work">请求失败：${esc(err.message || '未知错误')}</div>`;
  }
}

function renderSurgeryFeedback(stepNumber, feedback) {
  const el = document.getElementById(`surgeryFeedback${stepNumber}`);
  if (!el) return;
  if (!feedback) {
    el.innerHTML = '';
    return;
  }
  const isGood = feedback.verdict === 'good';
  const cls = isGood ? 'good' : 'needs-work';
  const icon = isGood ? '✅' : '✏️';
  let html = `<div class="surgery-feedback-card ${cls}">`;
  html += `<div class="surgery-feedback-line"><span class="surgery-feedback-icon">${icon}</span>${esc(feedback.comment || '')}</div>`;
  if (!isGood && feedback.suggestion) {
    html += `<div class="surgery-feedback-suggestion"><strong>建议改为：</strong>${esc(feedback.suggestion)}</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

// ---- Surgery finalize ----
async function finalizeSurgery() {
  if (!sessionId) {
    alert('请先开始一次错题手术。');
    return;
  }
  const s1 = els.surgeryStep1Input.value.trim();
  const s2 = els.surgeryStep2Input.value.trim();
  const s3 = els.surgeryStep3Input.value.trim();
  if (!s1 || !s2 || !s3) {
    alert('请先把三步都填完，再生成手术卡。');
    return;
  }

  // Make sure each step is saved (fire-and-forget if no feedback on file yet)
  const questionText = els.surgeryQuestionInput ? els.surgeryQuestionInput.value.trim() : '';
  try {
    await Promise.all([
      fetch(`/api/session/${sessionId}/surgery/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepNumber: 1, stepContent: s1, questionText, wantFeedback: false })
      }),
      fetch(`/api/session/${sessionId}/surgery/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepNumber: 2, stepContent: s2, questionText, wantFeedback: false })
      }),
      fetch(`/api/session/${sessionId}/surgery/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepNumber: 3, stepContent: s3, questionText, wantFeedback: false })
      })
    ]);
  } catch (e) {
    console.warn('Pre-save steps failed:', e);
  }

  els.summaryPanel.hidden = false;
  els.summaryContent.innerHTML = '<p style="color:var(--muted);padding:20px;text-align:center;">正在给你生成错题手术卡，请稍候…</p>';
  els.summaryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const res = await fetch(`/api/session/${sessionId}/surgery/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText })
    });
    const data = await res.json();
    if (data.error) {
      els.summaryContent.innerHTML = `<p style="color:#b91c1c;padding:20px;">${esc(data.message || data.error)}</p>`;
      return;
    }
    surgeryFinalized = true;
    els.summaryContent.innerHTML = renderSurgeryCardHtml({
      surgeryCard: data.card,
      steps: { step1: s1, step2: s2, step3: s3 }
    });
    addMessage('assistant', `🗂️ 错题手术卡已生成：${data.card?.title || '错题手术卡'}`, 'SURGERY_CARD');
  } catch (err) {
    els.summaryContent.innerHTML = `<p style="color:#b91c1c;padding:20px;">生成失败：${esc(err.message || '未知错误')}</p>`;
  }
}

// ---- Wire up ----
if (els.newSessionBtn) els.newSessionBtn.addEventListener('click', createSession);
els.sendBtn.addEventListener('click', () => sendMessage());

// Example hint: clear-example link
const clearExampleLink = document.getElementById('clearExampleLink');
if (clearExampleLink) {
  clearExampleLink.addEventListener('click', (e) => {
    e.preventDefault();
    const qInput = document.getElementById('questionInput');
    if (qInput) {
      qInput.value = '';
      qInput.focus();
    }
    const exampleHint = document.getElementById('exampleHint');
    if (exampleHint) exampleHint.style.display = 'none';
  });
}
if (els.loadSummaryBtn) els.loadSummaryBtn.addEventListener('click', loadSummary);
const submitExamBtn = document.getElementById('submitExamBtn');
if (submitExamBtn) submitExamBtn.addEventListener('click', submitExam);

// Mode switch with confirmation when there's existing conversation
// 记住当前模式,这样切换被取消时可以回滚
let currentMode = els.modeSelect ? els.modeSelect.value : 'practice';

// 取得某个模式对应的开场白文本
function getModeOpeningMessage(mode) {
  if (mode === 'exam') {
    return '考试模式已开始。我不会给任何提示，请独立作答。完成后点"提交答案"，我才会帮你复盘。';
  }
  if (mode === 'micro_surgery') {
    return '准备好了吗？把那道错题贴在左边，我们就开始第一步。';
  }
  // practice (default) — 改得更具体、更有引导性，让学生有话可说
  return '好，这道题我们一起看。先不急着算 —— 你读完题之后，先告诉我两件事：\n\n' +
         '1. **你看懂题目在问什么了吗？** 哪个词或哪个条件让你不太确定？\n' +
         '2. **如果让你现在动笔，第一步你打算干什么？** 哪怕只是"我想先把图画出来"也行。\n\n' +
         '说出来就行，不用先想"对不对"。';
}

// 判断聊天框里是否有真正的对话(用户说过话)
function hasUserMessages() {
  if (!els.chatLog) return false;
  return els.chatLog.querySelectorAll('.chat-msg.user').length > 0;
}

if (els.modeSelect) {
  els.modeSelect.addEventListener('change', () => {
    const newMode = els.modeSelect.value;
    if (newMode === currentMode) return;  // 没真切

    // 如果对话还没真正开始 (没有用户发过消息),直接切,不打扰
    if (!hasUserMessages()) {
      currentMode = newMode;
      applyModeUi(newMode);
      // 清掉之前的欢迎语 / 旧开场白,显示新模式的介绍
      els.chatLog.innerHTML = '';
      addMessage('assistant', getModeOpeningMessage(newMode), 'SYSTEM');
      return;
    }

    // 已经在聊天了 — 弹确认
    const modeNames = { practice: '练习', exam: '考试', micro_surgery: '错题手术' };
    const ok = window.confirm(
      `切换到"${modeNames[newMode] || newMode}"模式会清空当前对话。\n\n确定要切换吗？`
    );
    if (!ok) {
      // 学生取消了 — 把下拉框跳回原来的值
      els.modeSelect.value = currentMode;
      return;
    }

    // 学生确认了 — 真正切换
    currentMode = newMode;
    applyModeUi(newMode);
    els.chatLog.innerHTML = '';
    addMessage('assistant', getModeOpeningMessage(newMode), 'SYSTEM');

    // 重置 session 状态 (跟原来 createSession 的清理一致)
    sessionId = null;
    sessionMode = newMode;
    examSubmitted = false;
    surgeryFinalized = false;
    if (els.summaryPanel) els.summaryPanel.hidden = true;
    // 隐藏 quick-actions 按钮 (新会话还没正式开始)
    const quickActionsCard = document.getElementById('quickActionsCard');
    if (quickActionsCard) quickActionsCard.style.display = 'none';
  });
}

// Surgery-mode wiring
if (els.newSurgeryBtn) els.newSurgeryBtn.addEventListener('click', createSession);
if (els.loadSurgeryCardBtn) els.loadSurgeryCardBtn.addEventListener('click', loadSummary);
if (els.surgeryFinalizeBtn) els.surgeryFinalizeBtn.addEventListener('click', finalizeSurgery);
document.querySelectorAll('.surgery-step-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const n = Number(btn.dataset.step);
    if ([1, 2, 3].includes(n)) refineSurgeryStep(n);
  });
});

document.querySelectorAll('.quick-actions button').forEach((btn) => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.text));
});

// Apply initial mode (in case user refreshes with exam or surgery preselected)
applyModeUi(els.modeSelect ? els.modeSelect.value : 'practice');

// 注：以前这里有一段"欢迎使用茹意宝..."的聊天消息，现在那段说明已经
// 搬到左边的功能介绍卡片里了，所以聊天框初始保持空，等学生点
// "开始陪练这道题"再让教练开口。

checkLlmHealth();
