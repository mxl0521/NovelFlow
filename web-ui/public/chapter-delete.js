(() => {
  const text = (value) => String(value || '').trim();
  const node = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined) element.textContent = value;
    return element;
  };
  const chapterTitle = (chapter) => {
    const value = text(chapter?.title)
      .replace(/^\u7b2c\s*\d+\s*\u7ae0\s*[\u00b7\u30fb|\uff5c:\uff1a-]?\s*/u, '')
      .replace(/^\u7b2c[\u4e00-\u9fff]+\u9636\u6bb5\s*[\u00b7\u30fb|\uff5c:\uff1a-]?\s*/u, '');
    const hidden = new Set(['\u89e6\u53d1\u4e8b\u4ef6', '\u89e6\u53d1', '\u5173\u7cfb\u5347\u7ea7', '\u4ee3\u4ef7\u4e0e\u53cd\u8f6c', '\u53d7\u963b', '\u8bd5\u63a2', '\u53cd\u8bc1', '\u5347\u7ea7', '\u8bbe\u5c40', '\u903c\u8fd1', '\u51b3\u65ad']);
    return value.split(/[\u00b7\u30fb|\uff5c]/u).map(text).filter((part) => part && !hidden.has(part)).join(' \u00b7 ') || '\u672a\u547d\u540d\u7ae0\u8282';
  };
  const request = async (url, options = {}) => {
    const response = await fetch(url, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '\u8bf7\u6c42\u5931\u8d25');
    return result;
  };
  const closeDialogs = () => document.querySelectorAll('.chapter-action-backdrop').forEach((item) => item.remove());
  const pageLabels = {
    home: ['\u521b\u4f5c\u9996\u9875', '\u9996\u9875'],
    projects: ['\u6211\u7684\u4f5c\u54c1', '\u4f5c\u54c1'],
    ideas: ['\u7075\u611f\u52a9\u624b', '\u7075\u611f'],
    writing: ['\u5199\u4f5c\u53f0', '\u5199\u4f5c'],
    story: ['\u6545\u4e8b\u8d44\u6599', '\u4f5c\u54c1\u8d44\u6599'],
    workflow: ['AI \u7f16\u8f91\u56e2\u961f', '\u751f\u6210\u4efb\u52a1'],
  };
  const navLabel = (button) => text(button?.querySelector('span:not(.nav-step)')?.textContent || button?.textContent);
  const pageKey = (label) => Object.entries(pageLabels).find(([, labels]) => labels.includes(label))?.[0] || label;
  const findPageButton = (key) => [...document.querySelectorAll('.primary-nav button, .home-primary-nav button, .mobile-nav button')]
    .find((button) => pageKey(navLabel(button)) === key);
  const rememberPage = () => {
    const active = document.querySelector('.primary-nav .nav-item.active, .home-primary-nav button.active, .mobile-nav button.active');
    const key = pageKey(navLabel(active));
    if (key) sessionStorage.setItem('novelflow-current-page', key);
  };
  const showToast = (message) => {
    document.querySelector('.chapter-action-toast')?.remove();
    const toast = node('div', 'chapter-action-toast', message);
    document.body.append(toast);
    window.setTimeout(() => toast.classList.add('show'), 20);
    window.setTimeout(() => toast.remove(), 2600);
  };
  const modal = (title, copy) => {
    closeDialogs();
    const backdrop = node('div', 'chapter-action-backdrop');
    const dialog = node('section', 'chapter-action-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const head = node('header', 'chapter-action-head');
    const heading = node('div');
    heading.append(node('h2', '', title), node('p', '', copy));
    const close = node('button', 'chapter-action-close', '\u00d7');
    close.type = 'button';
    close.setAttribute('aria-label', '\u5173\u95ed');
    close.onclick = closeDialogs;
    head.append(heading, close);
    dialog.append(head);
    backdrop.append(dialog);
    backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop) closeDialogs(); });
    document.body.append(backdrop);
    return dialog;
  };
  const openDelete = (project, chapterId) => {
    const chapter = (project?.chapters || []).find((item) => String(item.id) === String(chapterId));
    if (!chapter) return;
    const dialog = modal(`\u5220\u9664\u7b2c ${Number(chapterId)} \u7ae0`, '\u7ae0\u8282\u4f1a\u4ece\u5f53\u524d\u4f5c\u54c1\u4e2d\u79fb\u9664\uff0c\u4f46\u4ecd\u53ef\u4ee5\u5728\u201c\u6700\u8fd1\u5220\u9664\u201d\u4e2d\u6062\u590d\u3002');
    const summary = node('div', 'chapter-delete-summary');
    const title = node('strong', '', chapterTitle(chapter));
    const meta = node('div', 'chapter-delete-meta');
    const words = text(chapter.body).replace(/\s/g, '').length;
    meta.append(node('span', '', chapter.status || '\u672a\u5f00\u59cb'), node('span', '', `${words.toLocaleString()} \u5b57`));
    summary.append(title, meta);
    const warning = node('p', 'chapter-delete-warning', chapter.status === '\u5df2\u5b9a\u7a3f' ? '\u8fd9\u662f\u5df2\u5b9a\u7a3f\u7ae0\u8282\u3002\u5220\u9664\u540e\uff0c\u8be5\u7ae0\u7684\u6458\u8981\u3001\u4efb\u52a1\u548c\u7ae0\u8282\u8bb0\u5fc6\u4e5f\u4f1a\u4e00\u8d77\u79fb\u5165\u6700\u8fd1\u5220\u9664\u3002' : '\u8be5\u7ae0\u7684\u89c4\u5212\u3001\u6b63\u6587\u548c\u7ae0\u8282\u8bb0\u5fc6\u5c06\u4e00\u8d77\u79fb\u5165\u6700\u8fd1\u5220\u9664\u3002');
    const error = node('div', 'chapter-action-error');
    const actions = node('div', 'chapter-action-buttons');
    const cancel = node('button', 'chapter-action-secondary', '\u53d6\u6d88');
    cancel.type = 'button'; cancel.onclick = closeDialogs;
    const confirm = node('button', 'chapter-action-danger', '\u79fb\u5230\u6700\u8fd1\u5220\u9664');
    confirm.type = 'button';
    confirm.onclick = async () => {
      confirm.disabled = true; confirm.textContent = '\u6b63\u5728\u5220\u9664...'; error.textContent = '';
      try {
        rememberPage();
        const result = await request('/api/project/chapters/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: String(chapterId) }) });
        if (result.nextChapterId) sessionStorage.setItem('novelflow-select-chapter', String(result.nextChapterId));
        sessionStorage.setItem('novelflow-chapter-message', `\u5df2\u5220\u9664\u7b2c ${Number(chapterId)} \u7ae0\uff0c\u53ef\u5728\u201c\u6700\u8fd1\u5220\u9664\u201d\u4e2d\u6062\u590d`);
        window.location.reload();
      } catch (errorValue) {
        error.textContent = errorValue.message || '\u7ae0\u8282\u5220\u9664\u5931\u8d25';
        confirm.disabled = false; confirm.textContent = '\u79fb\u5230\u6700\u8fd1\u5220\u9664';
      }
    };
    actions.append(cancel, confirm);
    dialog.append(summary, warning, error, actions);
  };
  const openTrash = async () => {
    const dialog = modal('\u6700\u8fd1\u5220\u9664', '\u5220\u9664\u7684\u7ae0\u8282\u4fdd\u7559\u5728\u5f53\u524d\u4f5c\u54c1\u4e2d\uff0c\u6062\u590d\u540e\u4f1a\u6309\u539f\u4f4d\u7f6e\u91cd\u65b0\u7f16\u53f7\u3002');
    const content = node('div', 'chapter-trash-content');
    content.append(node('div', 'chapter-trash-loading', '\u6b63\u5728\u8bfb\u53d6...'));
    dialog.append(content);
    try {
      const result = await request('/api/project/chapters/trash');
      const chapters = Array.isArray(result.chapters) ? result.chapters : [];
      content.replaceChildren();
      if (!chapters.length) {
        const empty = node('div', 'chapter-trash-empty');
        empty.append(node('strong', '', '\u8fd8\u6ca1\u6709\u5220\u9664\u7684\u7ae0\u8282'), node('span', '', '\u4ece\u7ae0\u8282\u53f3\u4fa7\u7684\u5220\u9664\u56fe\u6807\u53ef\u4ee5\u5c06\u7ae0\u8282\u79fb\u5230\u8fd9\u91cc\u3002'));
        content.append(empty); return;
      }
      chapters.forEach((archive) => {
        const chapter = archive.chapter || {};
        const row = node('article', 'chapter-trash-row');
        const copy = node('div');
        copy.append(node('strong', '', `\u7b2c ${Number(chapter.id)} \u7ae0\u3000${chapterTitle(chapter)}`));
        const deletedAt = archive.deletedAt ? new Date(archive.deletedAt).toLocaleString('zh-CN', { hour12: false }) : '';
        copy.append(node('span', '', `${chapter.status || '\u672a\u5f00\u59cb'}${deletedAt ? ` \u00b7 ${deletedAt}` : ''}`));
        const restore = node('button', 'chapter-restore-button', '\u6062\u590d');
        restore.type = 'button';
        restore.onclick = async () => {
          restore.disabled = true; restore.textContent = '\u6b63\u5728\u6062\u590d...';
          try {
            rememberPage();
            const restored = await request('/api/project/chapters/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashId: archive.trashId }) });
            sessionStorage.setItem('novelflow-select-chapter', String(restored.chapter?.id || chapter.id));
            sessionStorage.setItem('novelflow-chapter-message', `\u7b2c ${Number(chapter.id)} \u7ae0\u5df2\u6062\u590d`);
            window.location.reload();
          } catch (errorValue) {
            restore.disabled = false; restore.textContent = '\u6062\u590d'; showToast(errorValue.message || '\u7ae0\u8282\u6062\u590d\u5931\u8d25');
          }
        };
        row.append(copy, restore); content.append(row);
      });
    } catch (errorValue) {
      content.replaceChildren(node('div', 'chapter-action-error', errorValue.message || '\u6700\u8fd1\u5220\u9664\u8bfb\u53d6\u5931\u8d25'));
    }
  };
  const enhance = (project) => {
    const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
    document.querySelectorAll('.chapter-row').forEach((row) => {
      const chapterId = row.querySelector('.chapter-number')?.textContent?.trim();
      if (!chapterId || row.querySelector('.chapter-delete-button')) return;
      const button = node('span', 'chapter-delete-button', '\u232b');
      button.setAttribute('role', 'button'); button.setAttribute('tabindex', '0');
      button.setAttribute('title', chapters.length <= 1 ? '\u4f5c\u54c1\u81f3\u5c11\u9700\u8981\u4fdd\u7559\u4e00\u4e2a\u7ae0\u8282' : '\u5220\u9664\u7ae0\u8282');
      button.setAttribute('aria-label', '\u5220\u9664\u7ae0\u8282');
      if (chapters.length <= 1) button.setAttribute('aria-disabled', 'true');
      const activate = (event) => { event.preventDefault(); event.stopPropagation(); if (chapters.length > 1) openDelete(project, chapterId); };
      button.addEventListener('click', activate);
      button.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') activate(event); });
      row.append(button);
    });
    const createButton = document.querySelector('.new-chapter');
    if (createButton && !document.querySelector('.chapter-trash-button')) {
      const trashButton = node('button', 'chapter-trash-button');
      trashButton.type = 'button';
      trashButton.append(node('span', 'chapter-trash-icon', '\u232b'), node('span', '', '\u6700\u8fd1\u5220\u9664'), node('em', '', '0'));
      fetch('/api/project/chapters/trash').then((response) => response.ok ? response.json() : null).then((result) => {
        const count = Array.isArray(result?.chapters) ? result.chapters.length : 0;
        const badge = trashButton.querySelector('em'); if (badge) badge.textContent = String(count);
      }).catch(() => {});
      trashButton.onclick = openTrash;
      createButton.after(trashButton);
    }
    const pending = sessionStorage.getItem('novelflow-select-chapter');
    if (pending) {
      const target = [...document.querySelectorAll('.chapter-row')].find((row) => row.querySelector('.chapter-number')?.textContent?.trim() === pending);
      if (!target) {
        const writing = findPageButton('writing');
        if (writing) window.setTimeout(() => writing.click(), 40);
      } else {
        sessionStorage.removeItem('novelflow-select-chapter');
        window.setTimeout(() => {
          target.click();
          const savedPage = sessionStorage.getItem('novelflow-current-page');
          if (!savedPage || pageKey(savedPage) === 'writing') {
            sessionStorage.removeItem('novelflow-current-page');
            return;
          }
          window.setTimeout(() => {
            const pageButton = findPageButton(pageKey(savedPage));
            if (pageButton) { pageButton.click(); sessionStorage.removeItem('novelflow-current-page'); }
          }, 80);
        }, 80);
      }
    }
    const message = sessionStorage.getItem('novelflow-chapter-message');
    if (message) { sessionStorage.removeItem('novelflow-chapter-message'); showToast(message); }
  };
  fetch('/api/project').then((response) => response.ok ? response.json() : null).then((data) => {
    const project = data?.project || data; if (!project) return;
    let timer = 0;
    const schedule = () => { clearTimeout(timer); timer = window.setTimeout(() => enhance(project), 120); };
    schedule();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }).catch(() => {});
})();
