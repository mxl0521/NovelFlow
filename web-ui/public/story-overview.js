(() => {
  const u = (s) => String(s || '').trim();
  const clip = (s, n = 180) => { const t = u(s).replace(/\s+/g, ' '); return t.length > n ? `${t.slice(0, n).trim()}...` : t; };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const cleanTitle = (s) => {
    const ignored = ['触发事件', '触发', '关系升级', '代价与反转', '阶段决断', '主线决断', '受阻', '试探', '反证', '升级', '设局', '逼近', '决断', '待细化'];
    const parts = u(s).replace(/^第\s*\d+\s*章\s*[·・|｜:：-]?\s*/u, '').replace(/^第[一二三四五六七八九十百]+阶段\s*[·・|｜:：-]?\s*/u, '').split(/[·・|｜]/u).map(u).filter(Boolean);
    return parts.filter((p) => !ignored.includes(p) && !/^第.+阶段$/u.test(p)).join(' · ') || '未命名章节';
  };
  const characters = (project) => {
    const kit = project?.memory?.project_kit || {};
    const configured = (Array.isArray(kit.characters) ? kit.characters : []).filter((x) => x && !/^(主角|关键对手|关键人物\d*)$/.test(u(x.name))).map((x) => ({ name: u(x.name), role: u(x.role) || '故事人物', note: u(x.arc || x.state || x.description) }));
    if (configured.length) return configured.slice(0, 6);
    const states = project?.memory?.chapter_character_states || {}, lines = Object.keys(states).sort().reverse().flatMap((key) => Array.isArray(states[key]) ? states[key] : []), found = [], seen = new Set();
    lines.forEach((line) => { const match = u(line).match(/^(周野|周父|老板|[\u4e00-\u9fff]{2,4})(?:在|已|确认|清楚|表现|发现|将|失去|面临|仍|因|承认)/u); if (!match || seen.has(match[1])) return; seen.add(match[1]); found.push({ name: match[1], role: '当前动态', note: clip(line, 90) }); });
    return found.slice(0, 6);
  };
  const sendToAssistant = () => {
    [...document.querySelectorAll('.assistant-tabs button')].find((b) => /对话|聊天|助手/.test(b.textContent || ''))?.click();
    setTimeout(() => {
      const input = document.querySelector('.assistant-composer textarea'); if (!input) return;
      const prompt = '请根据当前作品和已完成章节，重新整理：1. 故事简介；2. 主要人物及当前状态；3. 故事已经发展到哪里；4. 还有哪些未解谜团。请用简单中文说明，不要使用技术术语。';
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(input, prompt);
      input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };
  const singleEntry = () => {
    const nav = document.querySelector('.asset-nav'); if (!nav || nav.querySelector('.simple-story-entry')) return;
    [...nav.children].forEach((x) => x.classList.add('legacy-story-entry'));
    const button = el('button', 'simple-story-entry'); button.type = 'button'; button.append(el('span', 'simple-story-entry-icon', '≡'), el('span', '', '作品资料'));
    button.onclick = () => { const target = [...document.querySelectorAll('.primary-nav button')].find((x) => x.textContent.includes('作品资料')); (target || nav.querySelector('.legacy-story-entry'))?.click(); };
    nav.prepend(button);
  };
  const sectionHead = (title, hint = '') => { const h = el('header'); h.append(el('div', 'story-overview-section-title', title)); if (hint) h.append(el('span', 'story-overview-section-hint', hint)); return h; };
  const build = (project) => {
    const root = el('div', 'simple-story-overview'), kit = project?.memory?.project_kit || {}, chapters = Array.isArray(project?.chapters) ? project.chapters : [], summaries = project?.memory?.chapter_summaries || {};
    const hero = el('section', 'story-overview-hero'), copy = el('div', 'story-overview-hero-copy');
    copy.append(el('span', 'story-overview-eyebrow', '这是你的故事全景'), el('h1', '', u(project?.title).replace(/[《》]/g, '') || '未命名作品'), el('p', '', '系统会随章节更新人物、进度和未解线索，你只需要确认故事是否按预期发展。'));
    const done = chapters.filter((x) => x.status === '已定稿').length, total = Number(project?.settings?.chapterCount) || chapters.length || 1, progress = el('div', 'story-overview-progress');
    progress.append(el('strong', '', `${done} / ${total}`), el('span', '', '章节已定稿')); const bar = el('i', 'story-overview-progress-bar'), fill = el('b'); fill.style.width = `${Math.min(100, Math.round(done / total * 100))}%`; bar.append(fill); progress.append(bar); hero.append(copy, progress);
    const synopsis = el('section', 'story-overview-section story-overview-synopsis'); synopsis.append(sectionHead('故事简介'), el('p', 'story-overview-main-copy', clip(kit.synopsis || project?.settings?.premise, 420) || '还没有故事简介，可以让 AI 根据已有章节帮你整理。'));
    const people = el('section', 'story-overview-section'), peopleGrid = el('div', 'story-character-grid'), list = characters(project); people.append(sectionHead('主要人物', '随正文自动更新'));
    if (!list.length) peopleGrid.append(el('p', 'story-overview-empty', '写完第一章后，这里会自动整理主要人物。'));
    list.forEach((item, i) => { const card = el('article', 'story-character-card'), avatar = el('span', 'story-character-avatar', item.name.slice(0, 1)), info = el('div'), heading = el('div', 'story-character-heading'); avatar.dataset.tone = String(i % 4); heading.append(el('strong', '', item.name), el('em', '', item.role)); info.append(heading, el('p', '', clip(item.note, 110) || '暂无人物动态')); card.append(avatar, info); peopleGrid.append(card); }); people.append(peopleGrid);
    const development = el('section', 'story-overview-section'), stageGrid = el('div', 'story-stage-grid'); development.append(sectionHead('故事发展', '点击章节可回到写作'));
    [['开始', '人物登场，问题出现'], ['发展', '行动受阻，关系变化'], ['转折', '新线索改变原有判断'], ['结局', '回收线索，完成关键选择']].forEach(([name, help], i) => {
      const start = Math.floor(i * chapters.length / 4), end = Math.floor((i + 1) * chapters.length / 4), group = chapters.slice(start, Math.max(start + 1, end)), card = el('article', 'story-stage-card'), head = el('header'), rows = el('div', 'story-stage-chapters'); head.append(el('strong', '', name), el('span', '', help)); card.append(head);
      if (!group.length) rows.append(el('p', 'story-overview-empty', '等待规划'));
      group.forEach((chapter) => { const row = el('button', 'story-stage-chapter'); row.type = 'button'; const info = el('span'); info.append(el('b', '', `第 ${Number(chapter.id) || chapter.id} 章　${cleanTitle(chapter.title)}`), el('small', '', clip(summaries[chapter.id] || chapter.goal, 92) || '暂无章节摘要')); row.append(info, el('em', chapter.status === '已定稿' ? 'is-done' : '', chapter.status || '未开始')); row.onclick = () => [...document.querySelectorAll('.chapter-row')].find((x) => x.querySelector('.chapter-number')?.textContent?.trim() === String(chapter.id))?.click(); rows.append(row); });
      card.append(rows); stageGrid.append(card);
    }); development.append(stageGrid);
    const mystery = el('section', 'story-overview-section story-mystery-section'), mysteryList = el('div', 'story-mystery-list'); mystery.append(sectionHead('未解谜团', '写作时会提醒你回收'));
    const clues = Array.isArray(kit.foreshadows) ? kit.foreshadows : (Array.isArray(project?.memory?.foreshadows) ? project.memory.foreshadows : []); if (!clues.length) mysteryList.append(el('p', 'story-overview-empty', '目前没有待解开的谜团。'));
    clues.slice(0, 8).forEach((clue, i) => { const row = el('div', 'story-mystery-item'); row.append(el('span', 'story-mystery-mark', String(i + 1)), el('p', '', u(clue?.content || clue?.title || clue))); mysteryList.append(row); }); mystery.append(mysteryList);
    const world = el('details', 'story-world-rules'), summary = el('summary'), rules = el('div', 'story-world-rule-list'); summary.append(el('strong', '', '世界规则'), el('span', '', '需要时再展开')); const worldRules = Array.isArray(kit.worldRules) ? kit.worldRules : [];
    if (!worldRules.length) rules.append(el('p', 'story-overview-empty', '还没有世界规则。')); worldRules.forEach((rule) => rules.append(el('p', '', u(rule)))); world.append(summary, rules);
    root.append(hero, synopsis, people, development, mystery, world); return root;
  };
  const enhance = (project) => {
    singleEntry(); const page = document.querySelector('.view-page[aria-label="作品资料"]'), editor = page?.querySelector('.story-editor'), head = page?.querySelector('.view-head'); if (!page || !editor || !head) return;
    page.classList.add('story-overview-page'); editor.classList.add('professional-story-editor'); const signature = JSON.stringify({ u: project?.updated_at, c: (project?.chapters || []).map((x) => [x.id, x.title, x.status, x.revision]), k: project?.memory?.project_kit, s: project?.memory?.chapter_character_states }); let overview = page.querySelector('.simple-story-overview');
    if (!overview || page.dataset.overviewSignature !== signature) { overview?.remove(); overview = build(project); head.after(overview); page.dataset.overviewSignature = signature; }
    if (!head.querySelector('.story-overview-actions')) { const actions = el('div', 'story-overview-actions'), ai = el('button', 'story-overview-ai', 'AI 帮我整理'), pro = el('button', 'story-overview-pro', '专业资料'); ai.type = pro.type = 'button'; ai.onclick = sendToAssistant; pro.onclick = () => { const show = !page.classList.contains('show-professional-story'); page.classList.toggle('show-professional-story', show); pro.textContent = show ? '返回简洁资料' : '专业资料'; (show ? editor : overview).scrollIntoView({ behavior: 'smooth', block: 'start' }); }; actions.append(ai, pro); head.append(actions); }
  };
  fetch('/api/project').then((r) => r.ok ? r.json() : null).then((data) => { const project = data?.project || data; if (!project) return; let timer; const run = () => { clearTimeout(timer); timer = setTimeout(() => enhance(project), 100); }; run(); new MutationObserver(run).observe(document.body, { childList: true, subtree: true }); }).catch(() => {});
})();
