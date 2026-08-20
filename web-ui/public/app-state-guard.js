(() => {
  const stateClass = 'nf-bootstrap';
  let overlay = null;
  let projectPoll = 0;

  const removeOverlay = () => {
    overlay?.remove();
    overlay = null;
  };

  const revealApp = ({ empty = false } = {}) => {
    document.documentElement.classList.remove(stateClass);
    document.documentElement.classList.toggle('nf-no-project', empty);
    removeOverlay();
  };

  const watchForCreatedProject = () => {
    window.clearInterval(projectPoll);
    projectPoll = window.setInterval(async () => {
      try {
        const response = await fetch('/api/projects', { cache: 'no-store' });
        const payload = response.ok ? await response.json() : null;
        if (Array.isArray(payload?.projects) && payload.projects.length > 0) {
          document.documentElement.classList.remove('nf-no-project');
          window.clearInterval(projectPoll);
        }
      } catch {
        // The regular offline state will be shown after the next full page load.
      }
    }, 1500);
  };

  const buttonWithText = (text) => Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent.trim().includes(text)
  );

  const openCreateProject = () => {
    revealApp({ empty: true });
    watchForCreatedProject();
    const startedAt = Date.now();
    const attempt = () => {
      const createButton = buttonWithText('新建作品');
      if (createButton) {
        createButton.click();
        return;
      }
      const projectsButton = buttonWithText('我的作品');
      projectsButton?.click();
      if (Date.now() - startedAt < 3000) window.setTimeout(attempt, 100);
    };
    window.setTimeout(attempt, 50);
  };

  const renderState = ({ type, title, message }) => {
    removeOverlay();
    overlay = document.createElement('main');
    overlay.className = `nf-state nf-state-${type}`;
    overlay.setAttribute('role', type === 'offline' ? 'alert' : 'status');

    const mark = document.createElement('div');
    mark.className = 'nf-state-mark';
    mark.textContent = type === 'offline' ? '!' : '+';

    const heading = document.createElement('h1');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = message;
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'nf-state-action';
    action.textContent = type === 'offline' ? '重新检测' : '新建第一个作品';
    action.addEventListener('click', type === 'offline' ? checkState : openCreateProject);

    overlay.append(mark, heading, copy, action);
    document.body.append(overlay);
  };

  async function checkState() {
    renderState({ type: 'checking', title: '正在连接 NovelFlow', message: '正在读取你的作品，请稍候。' });
    try {
      const [healthResponse, projectsResponse] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/projects', { cache: 'no-store' })
      ]);
      if (!healthResponse.ok || !projectsResponse.ok) throw new Error('service_unavailable');
      const payload = await projectsResponse.json();
      if (Array.isArray(payload.projects) && payload.projects.length > 0) {
        revealApp();
        return;
      }
      renderState({
        type: 'empty',
        title: '还没有作品',
        message: '从一个故事想法开始，NovelFlow 会带你完成设定、章节规划和正文创作。'
      });
    } catch {
      renderState({
        type: 'offline',
        title: '后端服务未连接',
        message: '作品数据没有加载。请先运行“启动NovelFlow.bat”，再重新检测。'
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkState, { once: true });
  } else {
    checkState();
  }
})();