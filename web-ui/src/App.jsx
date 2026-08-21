import { useCallback, useEffect, useState } from 'react'
import legacyStyles from './App.css?inline'
import './NovelFlow.css'
import LandingPage from './LandingPage.jsx'
import AppShell from './AppShell.jsx'
import HomePage from './HomePage.jsx'
import QuickCreateFlow from './QuickCreateFlow.jsx'
import ProjectOverviewPage from './ProjectOverviewPage.jsx'
import WritingRoom from './WritingRoom.jsx'
import { configureModel, createProject, fetchModels, fetchProject, fetchProjects, generateBlueprint, removeModel, requestClarifications, selectProject, testModel } from './api.js'
import { Bell, BookOpen, Bot, CheckCircle2, KeyRound, LoaderCircle, Search, Settings, Sparkles, Trash2, UsersRound, X } from 'lucide-react'
import './Utility.css'

function usableProjects(items) {
  return (items || []).filter((item) => typeof item?.id === 'string' && item.id.trim())
}

function applyWorkspaceStyles(frame, initialIdea = '') {
  const frameDocument = frame.contentDocument
  if (!frameDocument || frameDocument.getElementById('novelflow-source-styles')) return
  const style = frameDocument.createElement('style')
  style.id = 'novelflow-source-styles'
  style.textContent = legacyStyles
  frameDocument.head.append(style)
  if (!initialIdea) return
  const ideaInput = frameDocument.querySelector('#home-story-idea')
  if (!ideaInput) return
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(ideaInput, initialIdea)
  ideaInput.dispatchEvent(new window.Event('input', { bubbles: true }))
}

function App() {
  const [screen, setScreen] = useState('landing')
  const [initialIdea, setInitialIdea] = useState('')
  const [projects, setProjects] = useState([])
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => { fetchModels().catch(() => {}) }, [])

  const refreshProjects = useCallback(async () => {
    setLoading(true); setLoadError('')
    try {
      const [projectResponse, projectsResponse] = await Promise.all([fetchProject(), fetchProjects()])
      setProject(projectResponse.project || null)
      setProjects(usableProjects(projectsResponse.projects))
    } catch (error) { setLoadError(error.message || '暂时无法读取本地作品') } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (['home', 'stories', 'progress', 'notes', 'characters', 'world', 'stats', 'settings'].includes(screen)) refreshProjects() }, [refreshProjects, screen])

  const openHome = (idea = '') => { setInitialIdea(idea); setScreen('home'); setCreateOpen(Boolean(idea)) }
  const handleProjectSelect = async (projectId) => {
    try { const response = await selectProject(projectId); setProject(response.project || null); setProjects(usableProjects(response.projects || projects)); setScreen('project') } catch (error) { setLoadError(error.message || '切换作品失败') }
  }

  const openAssistant = () => { if (project?.chapters?.length) setScreen('writing'); else setCreateOpen(true) }
  const navigate = (target) => setScreen(target === 'home' ? 'home' : target)
  const panelTitle = { search: '搜索作品', notifications: '通知中心', profile: '账户菜单', settings: '设置' }
  const visibleProjects = usableProjects(projects)
  const renderWorkspaceView = () => {
    if (screen === 'home') return <HomePage project={project} projects={visibleProjects} loading={loading} error={loadError} onRetry={refreshProjects} onCreate={(idea = '') => { setInitialIdea(idea); setCreateOpen(true) }} onOpenProject={handleProjectSelect} onOpenWritingRoom={() => setScreen('writing')} onProjectsChanged={refreshProjects} />
    if (screen === 'stories') return <HomePage project={project} projects={visibleProjects} loading={loading} error={loadError} onRetry={refreshProjects} onCreate={(idea = '') => { setInitialIdea(idea); setCreateOpen(true) }} onOpenProject={handleProjectSelect} onOpenWritingRoom={() => setScreen('writing')} onProjectsChanged={refreshProjects} />
    if (screen === 'project') return <ProjectOverviewPage project={project} onBack={() => setScreen('home')} onOpenWritingRoom={() => setScreen('writing')} />
    if (screen === 'settings') return <SettingsPage />
    return <WorkspaceView view={screen} project={project} projects={visibleProjects} onOpenCreator={() => setCreateOpen(true)} onOpenWritingRoom={() => setScreen('writing')} />
  }

  if (screen === 'landing') return <LandingPage onStart={openHome} />
  if (screen === 'legacy') return <iframe className="novelflow-legacy-frame" title="NovelFlow legacy 写作房间" src="/novelflow-legacy.html" onLoad={(event) => applyWorkspaceStyles(event.currentTarget, initialIdea)} />
  if (screen === 'writing') return <WritingRoom project={project} onBack={() => setScreen('project')} onProjectRefresh={setProject} />

  return <AppShell project={project} view={screen} onNavigate={navigate} onOpenCreator={() => setCreateOpen(true)} onOpenWritingRoom={() => setScreen('writing')} onOpenAssistant={openAssistant} onOpenSearch={() => setScreen('search')} onOpenNotifications={() => setScreen('notifications')} onOpenProfile={() => setScreen('profile')}>
    {renderWorkspaceView()}
    {createOpen && <QuickCreateFlow initialIdea={initialIdea} onClose={() => setCreateOpen(false)} onClarify={requestClarifications} onGenerate={generateBlueprint} onCreate={async (settings, option) => { const response = await createProject(settings, option); setProject(response.project || null); setProjects(usableProjects(response.projects)); setInitialIdea(settings.premise || ''); setCreateOpen(false) }} />}
    {['search', 'notifications', 'profile'].includes(screen) && <UtilityDialog title={panelTitle[screen]} onClose={() => setScreen('home')} project={project} />}
  </AppShell>
}

function SettingsPage() {
  const [models, setModels] = useState([])
  const [form, setForm] = useState({ id: 'default', name: '默认模型', provider: 'OpenAI 兼容接口', model: 'gpt-5.6', baseUrl: '', apiKey: '', apiMode: 'chat' })
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function loadModels() {
    setBusy('load'); setError('')
    try { const response = await fetchModels(); setModels(response.models || []) } catch (requestError) { setError(requestError.message || '无法读取模型配置') } finally { setBusy('') }
  }
  useEffect(() => { loadModels() }, [])
  function updateField(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  async function saveModel(event) {
    event.preventDefault(); setBusy('save'); setNotice(''); setError('')
    try { await configureModel(form); setNotice('模型配置已保存，密钥由本机后端安全保管。'); setForm((current) => ({ ...current, apiKey: '' })); await loadModels() } catch (requestError) { setError(requestError.message || '模型配置保存失败') } finally { setBusy('') }
  }
  async function checkModel(id) {
    setBusy(`test:${id}`); setNotice(''); setError('')
    try { const response = await testModel(id); setNotice(`${response.model || '模型'}连接成功。`) } catch (requestError) { setError(requestError.message || '模型连接测试失败') } finally { setBusy('') }
  }
  async function deleteModel(id) {
    if (!window.confirm('删除这个自定义模型配置？')) return
    setBusy(`delete:${id}`); setNotice(''); setError('')
    try { await removeModel(id); setNotice('模型配置已删除。'); await loadModels() } catch (requestError) { setError(requestError.message || '模型配置删除失败') } finally { setBusy('') }
  }
  return <section className="nf-settings-page"><div className="nf-utility-heading"><div className="nf-ai-orb"><Settings size={20} /></div><div><h1>设置</h1><p>在这里接入模型 API，阿流会通过本机代理调用，不会把密钥放进浏览器。</p></div></div><section className="nf-settings-section"><header><div><h2><KeyRound size={17} />模型配置</h2><p>支持 OpenAI 兼容接口、DeepSeek、中转站和本地服务。</p></div><button type="button" className="nf-quiet-button" onClick={loadModels} disabled={busy === 'load'}>{busy === 'load' ? <LoaderCircle size={14} /> : '刷新状态'}</button></header><div className="nf-model-list">{models.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.provider} · {item.model}</span></div><div className="nf-model-actions"><span className={item.configured ? 'is-configured' : ''}>{item.configured ? <><CheckCircle2 size={14} />已配置</> : '未配置'}</span>{item.configured && <button type="button" onClick={() => checkModel(item.id)} disabled={busy !== ''}>{busy === `test:${item.id}` ? <LoaderCircle size={14} /> : '测试连接'}</button>}{item.id.startsWith('custom-') && <button type="button" className="nf-danger-button" onClick={() => deleteModel(item.id)} disabled={busy !== ''} title="删除模型"><Trash2 size={14} /></button>}</div></article>)}</div></section><form className="nf-settings-section nf-model-form" onSubmit={saveModel}><header><div><h2>添加或覆盖模型</h2><p>保存时只提交到 `127.0.0.1:8787`，API Key 不会写入前端代码。</p></div></header><div className="nf-settings-grid"><label>配置 ID<input value={form.id} onChange={(event) => updateField('id', event.target.value)} placeholder="default 或 custom-name" /></label><label>显示名称<input required value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="例如：我的 DeepSeek" /></label><label>服务商<input value={form.provider} onChange={(event) => updateField('provider', event.target.value)} placeholder="例如：DeepSeek" /></label><label>模型标识<input required value={form.model} onChange={(event) => updateField('model', event.target.value)} placeholder="例如：deepseek-chat" /></label><label className="nf-settings-wide">Base URL（可选）<input value={form.baseUrl} onChange={(event) => updateField('baseUrl', event.target.value)} placeholder="https://api.example.com/v1" /></label><label>API 模式<select value={form.apiMode} onChange={(event) => updateField('apiMode', event.target.value)}><option value="chat">Chat Completions</option><option value="responses">Responses</option></select></label><label className="nf-settings-wide">API Key<input required type="password" value={form.apiKey} onChange={(event) => updateField('apiKey', event.target.value)} placeholder="输入后只会保存到本机凭据存储" autoComplete="new-password" /></label></div><div className="nf-settings-foot"><span>{notice || (error ? '' : '建议先保存，再点击上方“测试连接”。')}</span><button type="submit" className="nf-primary-button" disabled={busy !== ''}>{busy === 'save' ? <><LoaderCircle size={14} />保存中…</> : '保存模型配置'}</button></div>{error && <p className="nf-settings-error" role="alert">{error}</p>}</form></section>
}

function WorkspaceView({ view, project, projects, onOpenCreator, onOpenWritingRoom }) {
  const chapters = project?.chapters || []
  const memory = project?.memory || {}
  const words = chapters.reduce((total, chapter) => total + String(chapter.body || '').replace(/\s/g, '').length, 0)
  const data = {
    progress: { icon: Sparkles, title: '写作进度', intro: '查看当前作品的章节完成情况和字数变化。', blocks: [['已完成章节', `${chapters.filter((chapter) => ['已定稿', '已完成'].includes(chapter.status)).length} / ${chapters.length || 0}`], ['当前字数', words.toLocaleString('zh-CN')], ['待写章节', `${chapters.filter((chapter) => chapter.status === '待写').length}`]] },
    notes: { icon: Sparkles, title: '灵感笔记', intro: '把零散想法交给阿流，写作时随时取用。', blocks: [['当前伏笔', `${(memory.foreshadows || []).length} 条`], ['创作决策', `${(memory.decisions || []).length} 条`]] },
    characters: { icon: UsersRound, title: '角色库', intro: '当前作品中的人物与状态。', list: (memory.project_kit?.characters || memory.characters || []).map((item) => `${item.name || '未命名人物'} · ${item.role || item.state || '状态待补充'}`) },
    world: { icon: BookOpen, title: '世界设定', intro: '阿流会在生成正文时参考这些规则。', list: memory.project_kit?.worldRules || [] },
    stats: { icon: Sparkles, title: '数据统计', intro: '当前作品的写作概况。', blocks: [['作品数量', `${projects.length}`], ['章节数量', `${chapters.length}`], ['总字数', words.toLocaleString('zh-CN')]] },
    settings: { icon: Settings, title: '设置', intro: '模型配置和工作台偏好仍由设置入口管理。', blocks: [['当前模型', '请在设置中查看'], ['数据位置', '本机保存']] },
  }[view] || { icon: Bot, title: '创作工作台', intro: '从左侧选择一个功能开始。', blocks: [] }
  const Icon = data.icon
  return <section className="nf-utility-page"><div className="nf-utility-heading"><div className="nf-ai-orb"><Icon size={20} /></div><div><h1>{data.title}</h1><p>{data.intro}</p></div></div>{!project && <div className="nf-data-notice"><span>还没有当前作品，先创建一个故事即可使用这里的功能。</span><button type="button" onClick={onOpenCreator}>新建故事</button></div>}{data.blocks && <div className="nf-utility-stats">{data.blocks.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>}{data.list && <div className="nf-utility-list">{data.list.length ? data.list.map((item, index) => <article key={`${item}-${index}`}><Icon size={15} /><span>{item}</span></article>) : <p>当前还没有记录。</p>}</div>}{project && <button type="button" className="nf-primary-button" onClick={onOpenWritingRoom}>进入写作房间</button>}</section>
}

function UtilityDialog({ title, onClose, project }) {
  const Icon = title === '搜索作品' ? Search : title === '通知中心' ? Bell : Bot
  return <div className="nf-utility-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="nf-utility-dialog" role="dialog" aria-modal="true" aria-labelledby="utility-title"><header><div><Icon size={18} /><h2 id="utility-title">{title}</h2></div><button type="button" title="关闭" onClick={onClose}><X size={17} /></button></header>{title === '搜索作品' ? <><input autoFocus placeholder="搜索作品名称或题材" /><p>{project ? `当前作品：${project.title}` : '还没有作品可搜索。'}</p></> : title === '通知中心' ? <p>目前没有新的通知。</p> : <p>当前账户：墨染流年<br />本地作品与设置保存在当前设备。</p>}</section></div>
}

export default App
