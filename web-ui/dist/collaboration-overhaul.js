(() => {
  let scheduled = false;

  const makeButton = (text, className, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || '';
    button.textContent = text;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler(event);
    }, true);
    return button;
  };

  const openModal = (title, subtitle, content) => {
    document.querySelector('.nf-collab-modal-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'nf-collab-modal-backdrop';
    const modal = document.createElement('section');
    modal.className = 'nf-collab-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = document.createElement('header');
    head.className = 'nf-collab-modal-head';
    const copy = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = title;
    const note = document.createElement('p');
    note.textContent = subtitle;
    copy.append(heading, note);
    const close = makeButton('\u5173\u95ed', 'nf-collab-modal-close', () => backdrop.remove());
    close.setAttribute('aria-label', '\u5173\u95ed\u8be6\u60c5');
    head.append(copy, close);
    const body = document.createElement('div');
    body.className = 'nf-collab-modal-content';
    body.append(content);
    modal.append(head, body);
    backdrop.append(modal);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) backdrop.remove();
    });
    document.body.append(backdrop);
    close.focus();
  };

  const addAdvancedToggle = (root) => {
    const pickerHeading = root.querySelector('.agent-picker-heading');
    if (!pickerHeading || root.querySelector('.nf-collab-advanced-toggle')) return;
    const row = document.createElement('div');
    row.className = 'nf-collab-advanced-toggle';
    const label = document.createElement('span');
    label.textContent = '\u9700\u8981\u7cbe\u7ec6\u63a7\u5236\u65f6\uff0c\u518d\u8c03\u6574\u9ad8\u7ea7 Agent\u3002';
    const button = makeButton('\u663e\u793a\u9ad8\u7ea7\u89d2\u8272', '', () => {
      const open = root.classList.toggle('nf-advanced-open');
      button.textContent = open ? '\u6536\u8d77\u9ad8\u7ea7\u89d2\u8272' : '\u663e\u793a\u9ad8\u7ea7\u89d2\u8272';
    });
    row.append(label, button);
    pickerHeading.before(row);
  };

  const enhanceWorkflowBoard = (root) => {
    const board = root.querySelector('.workflow-board');
    if (!board) return;
    const enabled = Array.from(board.children).filter((card) => !card.classList.contains('muted'));
    let summary = root.querySelector('.nf-agent-run-summary');
    if (!summary) {
      summary = document.createElement('div');
      summary.className = 'nf-agent-run-summary';
      board.before(summary);
    }
    summary.replaceChildren();
    const strong = document.createElement('b');
    strong.textContent = `\u672c\u6b21\u8fd0\u884c ${enabled.length} \u4e2a Agent`;
    const text = document.createElement('span');
    text.textContent = '\u9ed8\u8ba4\u5c55\u793a\u6458\u8981\uff0c\u9700\u8981\u65f6\u67e5\u770b\u5b8c\u6574\u7ed3\u679c\u3002';
    summary.append(strong, text);

    enabled.forEach((card) => {
      if (card.querySelector('.nf-agent-detail-button')) return;
      const title = card.querySelector('strong')?.textContent?.trim() || 'Agent \u7ed3\u679c';
      const content = card.querySelector('p')?.textContent?.trim() || '该 Agent 没有补充内容。';
      const button = makeButton('\u67e5\u770b\u8be6\u60c5', 'nf-agent-detail-button', () => {
        const paragraph = document.createElement('p');
        paragraph.className = 'nf-collab-modal-copy';
        paragraph.textContent = content;
        openModal(title, '\u8fd9\u662f\u8be5 Agent \u7684\u5b8c\u6574\u534f\u4f5c\u7ed3\u679c\uff0c\u4e0d\u4f1a\u76f4\u63a5\u5199\u5165\u6b63\u6587\u3002', paragraph);
      });
      card.append(button);
    });
  };

  const decisionText = (button) => {
    const clone = button.cloneNode(true);
    clone.querySelectorAll('small, svg').forEach((node) => node.remove());
    return clone.textContent.trim();
  };

  const openDecisionGroup = (label, buttons) => {
    const content = document.createElement('div');
    buttons.forEach((source) => {
      const row = document.createElement('label');
      row.className = `nf-decision-row${source.classList.contains('selected') ? ' selected' : ''}`;
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = source.classList.contains('selected');
      const text = document.createElement('span');
      text.textContent = decisionText(source);
      row.append(check, text);
      const toggle = () => {
        source.click();
        window.setTimeout(schedule, 0);
      };
      check.addEventListener('change', toggle);
      row.addEventListener('click', (event) => {
        if (event.target !== check) {
          event.preventDefault();
          check.checked = !check.checked;
          toggle();
        }
      });
      content.append(row);
    });
    openModal(label, '\u52fe\u9009\u540e\u4f1a\u540c\u6b65\u5230\u5f85\u91c7\u7eb3\u9879\u76ee\u4e2d\u3002', content);
  };

  const enhanceResult = (root) => {
    const result = root.querySelector('.workflow-result');
    if (!result) return;
    const decisions = Array.from(result.querySelectorAll('.decision-acceptance button'));
    let groups = result.querySelector('.nf-decision-groups');
    if (!groups) {
      groups = document.createElement('div');
      groups.className = 'nf-decision-groups';
      result.querySelector('.decision-acceptance')?.after(groups);
    }
    if (!decisions.length) return;
    const signature = decisions.map((button) => decisionText(button)).join('|');
    if (groups.dataset.signature === signature) return;
    groups.dataset.signature = signature;
    groups.replaceChildren();
    const grouped = new Map();
    decisions.forEach((button) => {
      const label = button.querySelector('small')?.textContent?.trim() || '\u534f\u4f5c\u5efa\u8bae';
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(button);
    });
    grouped.forEach((buttons, label) => {
      const card = document.createElement('article');
      card.className = 'nf-decision-group';
      const head = document.createElement('header');
      const title = document.createElement('strong');
      title.textContent = label;
      const count = document.createElement('em');
      count.textContent = `${buttons.length} \u6761\u5efa\u8bae`;
      head.append(title, count);
      const preview = document.createElement('div');
      preview.className = 'nf-decision-preview';
      preview.textContent = decisionText(buttons[0]);
      const action = makeButton(`\u67e5\u770b ${buttons.length} \u6761\u8be6\u60c5`, '', () => openDecisionGroup(label, buttons));
      card.append(head, preview, action);
      groups.append(card);
    });
  };

  const setReactTextarea = (textarea, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  };

  const enhanceAssistant = () => {
    const panel = document.querySelector('.assistant-panel:not(.is-collapsed)');
    if (!panel) return;
    const header = panel.querySelector('.assistant-header');
    if (header && !panel.querySelector('.nf-assistant-context')) {
      const context = document.createElement('div');
      context.className = 'nf-assistant-context';
      const dot = document.createElement('i');
      const text = document.createElement('span');
      text.textContent = '\u5df2\u540c\u6b65\u5f53\u524d\u7ae0\u8282\u3001\u4f5c\u54c1\u8bbe\u5b9a\u548c\u524d\u6587\u8bb0\u5fc6';
      context.append(dot, text);
      header.after(context);
    }
    const composer = panel.querySelector('.assistant-composer');
    if (!composer || panel.querySelector('.nf-assistant-quick-prompts')) return;
    const prompts = document.createElement('div');
    prompts.className = 'nf-assistant-quick-prompts';
    [
      '\u5206\u6790\u672c\u7ae0\u54ea\u91cc\u4e0d\u597d\uff0c\u5e76\u7ed9\u6211 3 \u6761\u53ef\u6267\u884c\u4fee\u6539\u5efa\u8bae',
      '\u4fdd\u7559\u5267\u60c5\uff0c\u91cd\u5199\u5f53\u524d\u7ae0\u8282\uff0c\u8ba9\u51b2\u7a81\u66f4\u5f3a\u3001\u753b\u9762\u611f\u66f4\u597d',
      '\u68c0\u67e5\u4eba\u7269\u884c\u4e3a\u3001\u65f6\u95f4\u7ebf\u548c\u4f0f\u7b14\u662f\u5426\u6709\u95ee\u9898'
    ].forEach((text) => prompts.append(makeButton(text, '', () => {
      const textarea = panel.querySelector('.assistant-composer textarea');
      if (textarea) setReactTextarea(textarea, text);
    })));
    composer.before(prompts);
  };

  const findRoot = () => Array.from(document.querySelectorAll('.view-page')).find((node) => {
    const label = node.getAttribute('aria-label') || '';
    return label.includes('AI') && (label.includes('\u7f16\u8f91') || label.includes('\u534f\u4f5c'));
  }) || document.querySelector('.workflow-presets')?.closest('.view-page');

  const apply = () => {
    scheduled = false;
    const root = findRoot();
    document.body.classList.toggle('nf-collab-v2', Boolean(root));
    if (root) {
      addAdvancedToggle(root);
      enhanceWorkflowBoard(root);
      enhanceResult(root);
    }
    enhanceAssistant();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(apply, 80);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
