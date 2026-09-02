import { useCallback, useEffect, useState } from 'react'
import legacyStyles from './App.css?inline'
import './NovelFlow.css'
import LandingPage from './LandingPage.jsx'
import AppShell from './AppShell.jsx'
import HomePage from './HomePage.jsx'
import QuickCreateFlow from './QuickCreateFlow.jsx'
import ProjectOverviewPage from './ProjectOverviewPage.jsx'
import WritingRoom from './WritingRoom.jsx'
import { configureModel, createProject, fetchModels, fetchProject, fetchProjects, generateBlueprint, getActiveModelId, removeModel, requestClarifications, selectProject, setActiveModelId, testModel } from './api.js'
import { Bell, BookOpen, Bot, CheckCircle2, KeyRound, LoaderCircle, Pencil, Search, Settings, Sparkles, Trash2, UsersRound, X } from 'lucide-react'
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
    if (screen === 'project') return <ProjectOverviewPage project={project} onBack={() => setScreen('home')} onOpenWritingRoom={() => setScreen('writing')} onProjectRefresh={setProject} />
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

const MODEL_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', provider: 'OpenAI', model: 'gpt-4.1', baseUrl: 'https://api.openai.com/v1', protocol: 'openai', apiMode: 'responses', note: '官方接口。模型标识可按你的账户权限修改。' },
  { id: 'deepseek', label: 'DeepSeek', provider: 'DeepSeek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1', protocol: 'openai', apiMode: 'chat', note: '使用 DeepSeek 官方 OpenAI 兼容接口。' },
  { id: 'qwen', label: '通义千问 / 百炼', provider: '通义千问', model: 'qwen-plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai', apiMode: 'chat', note: '使用阿里云百炼兼容模式接口。' },
  { id: 'doubao', label: '豆包 / 火山方舟', provider: '豆包', model: '', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai', apiMode: 'chat', note: '模型标识应填写火山方舟控制台中的推理接入点 ID。' },
  { id: 'claude', label: 'Claude', provider: 'Anthropic Claude', model: 'claude-sonnet-4-5', baseUrl: 'https://api.anthropic.com', protocol: 'anthropic', apiMode: 'chat', note: '使用 Anthropic 官方 Messages API，不是 OpenAI 兼容接口。' },
  { id: 'gemini', label: 'Gemini', provider: 'Google Gemini', model: 'gemini-2.5-flash', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', protocol: 'openai', apiMode: 'chat', note: '使用 Gemini 的 OpenAI 兼容接口。' },
  { id: 'custom', label: '自定义 / 中转站', provider: 'OpenAI 兼容接口', model: '', baseUrl: '', protocol: 'openai', apiMode: 'chat', note: '适用于 OneAPI、NewAPI、OpenRouter、硅基流动或其他兼容中转站。' },
]

const EMPTY_MODEL_FORM = { id: '', name: '', provider: 'OpenAI 兼容接口', model: '', baseUrl: '', apiKey: '', apiMode: 'chat', protocol: 'openai' }

function uniqueModelId(provider, name) {
  const normalized = `${provider}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `custom-${(normalized || 'model').slice(0, 30)}`
}

function SettingsPage() {
  const [models, setModels] = useState([])
  const [providerChoice, setProviderChoice] = useState('openai')
  const [form, setForm] = useState({ ...EMPTY_MODEL_FORM, id: 'custom-openai', name: '我的 OpenAI', provider: 'OpenAI', model: 'gpt-4.1', baseUrl: 'https://api.openai.com/v1', apiMode: 'responses' })
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [activeModelId, setActiveModelIdState] = useState(getActiveModelId())

  async function loadModels() {
    setBusy('load'); setError('')
    try { const response = await fetchModels(); setModels(response.models || []); setActiveModelIdState(getActiveModelId()) } catch (requestError) { setError(requestError.message || '无法读取模型配置') } finally { setBusy('') }
  }
  useEffect(() => { loadModels() }, [])
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])
  function updateField(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  function chooseProvider(nextId) {
    setProviderChoice(nextId)
    const preset = MODEL_PROVIDERS.find((item) => item.id === nextId) || MODEL_PROVIDERS.at(-1)
    setEditingId('')
    setForm({ ...EMPTY_MODEL_FORM, id: uniqueModelId(preset.provider, preset.label), name: `我的 ${preset.label}`, provider: preset.provider, model: preset.model, baseUrl: preset.baseUrl, protocol: preset.protocol, apiMode: preset.apiMode })
  }
  function beginEdit(item) {
    const matched = MODEL_PROVIDERS.find((preset) => preset.provider === item.provider && preset.protocol === item.protocol)
    setProviderChoice(matched?.id || 'custom')
    setEditingId(item.id)
    setForm({ id: item.id, name: item.name, provider: item.provider, model: item.model, baseUrl: item.baseUrl || '', apiKey: '', apiMode: item.apiMode || 'chat', protocol: item.protocol || 'openai' })
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }
  function resetForm() { chooseProvider('openai') }
  async function saveModel(event) {
    event.preventDefault(); setBusy('save'); setNotice(''); setError('')
    try { await configureModel(form); setNotice('模型配置已保存，密钥由本机后端安全保管。'); setForm((current) => ({ ...current, apiKey: '' })); await loadModels() } catch (requestError) { setError(requestError.message || '模型配置保存失败') } finally { setBusy('') }
  }
  async function checkModel(id) {
    setBusy(`test:${id}`); setNotice(''); setError('')
    try { const response = await testModel(id); setNotice(`${response.model || '模型'}连接成功。`) } catch (requestError) { setError(requestError.message || '模型连接测试失败') } finally { setBusy('') }
  }
  function switchModel(item) {
    setActiveModelId(item.id)
    setActiveModelIdState(item.id)
    setNotice(`已切换到：${item.name} · ${item.model}`)
    setError('')
  }
  async function deleteModel(id) {
    if (!window.confirm('删除这个模型配置？已保存的 API Key 也会从本机凭据库移除。')) return
    setBusy(`delete:${id}`); setNotice(''); setError('')
    try { await removeModel(id); setNotice('模型配置已删除。'); await loadModels() } catch (requestError) { setError(requestError.message || '模型配置删除失败') } finally { setBusy('') }
  }
  const selectedProvider = MODEL_PROVIDERS.find((item) => item.id === providerChoice) || MODEL_PROVIDERS.at(-1)
  const activeModel = models.find((item) => item.id === activeModelId && item.configured)
  return <section className="nf-settings-page"><div className="nf-utility-heading"><div className="nf-ai-orb"><Settings size={20} /></div><div><h1>设置</h1><p>为阿流接入多个模型。密钥只由本机代理加密保管，不会存进浏览器或作品数据。</p></div></div><section className="nf-settings-section"><header><div><h2><KeyRound size={17} />已接入模型</h2><p>切换后，阿流接下来的创作会使用你选择的模型。</p></div><button type="button" className="nf-quiet-button" onClick={loadModels} disabled={busy === 'load'}>{busy === 'load' ? <LoaderCircle size={14} /> : '刷新状态'}</button></header><div className="nf-active-model" aria-live="polite"><span>当前写作模型</span><strong>{activeModel ? activeModel.name : '尚未选择模型'}</strong><small>{activeModel ? `${activeModel.provider} · ${activeModel.model}` : '请从下方已配置模型中选择。'}</small></div><div className="nf-model-list">{models.map((item) => { const isActive = item.id === activeModelId && item.configured; return <article key={item.id} className={isActive ? 'is-active' : ''}><div><strong>{item.name}</strong><span>{item.provider} · {item.model}</span></div><div className="nf-model-actions">{isActive && <span className="nf-current-model-badge">当前使用中</span>}{item.configured && !isActive && <button type="button" className="nf-model-switch" onClick={() => switchModel(item)} disabled={busy !== ''}>切换到此模型</button>}<button type="button" className="nf-model-edit" onClick={() => beginEdit(item)} disabled={busy !== ''} title={`编辑 ${item.name}`} aria-label={`编辑 ${item.name}`}><Pencil size={14} /></button>{item.configured && <button type="button" onClick={() => checkModel(item.id)} disabled={busy !== ''}>{busy === `test:${item.id}` ? <LoaderCircle size={14} /> : '测试连接'}</button>}{item.managed && <button type="button" className="nf-danger-button" onClick={() => deleteModel(item.id)} disabled={busy !== ''} title={`删除 ${item.name}`} aria-label={`删除 ${item.name}`}><Trash2 size={14} /></button>}</div></article>})}</div></section><form className="nf-settings-section nf-model-form" onSubmit={saveModel}><header><div><h2>{editingId ? '编辑模型配置' : '添加模型'}</h2><p>{selectedProvider.note} {editingId ? 'API Key 留空即可保留原密钥。' : '保存后再测试连接。'}</p></div>{editingId && <button type="button" className="nf-quiet-button" onClick={resetForm}>添加新模型</button>}</header><div className="nf-provider-picker" role="group" aria-label="选择服务商">{MODEL_PROVIDERS.map((item) => <button type="button" key={item.id} className={providerChoice === item.id ? 'is-selected' : ''} onClick={() => chooseProvider(item.id)} disabled={busy !== '' || Boolean(editingId)}>{item.label}</button>)}</div><div className="nf-settings-grid"><label>显示名称<input required value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="例如：我的 DeepSeek" /></label><label>配置 ID<input required value={form.id} onChange={(event) => updateField('id', event.target.value)} placeholder="例如：custom-deepseek" readOnly={Boolean(editingId)} /></label><label>服务商名称<input required value={form.provider} onChange={(event) => updateField('provider', event.target.value)} placeholder="例如：DeepSeek" /></label><label>模型标识<input required value={form.model} onChange={(event) => updateField('model', event.target.value)} placeholder={providerChoice === 'doubao' ? '例如：ep-2026xxxx-xxxxx' : '例如：deepseek-chat'} /></label><label className="nf-settings-wide">Base URL<input value={form.baseUrl} onChange={(event) => updateField('baseUrl', event.target.value)} placeholder="https://api.example.com/v1" /></label><label>接口协议<select value={form.protocol} onChange={(event) => updateField('protocol', event.target.value)} disabled={providerChoice !== 'custom'}><option value="openai">OpenAI 兼容协议</option><option value="anthropic">Anthropic Messages</option></select></label><label>API 模式<select value={form.apiMode} onChange={(event) => updateField('apiMode', event.target.value)} disabled={form.protocol === 'anthropic'}><option value="chat">Chat Completions</option><option value="responses">Responses</option></select></label><label className="nf-settings-wide">API Key<input required={!editingId} type="password" value={form.apiKey} onChange={(event) => updateField('apiKey', event.target.value)} placeholder={editingId ? '留空则保留当前密钥；输入新 Key 则替换' : '输入后只会保存到本机凭据存储'} autoComplete="new-password" /></label></div><div className="nf-settings-foot"><span>{notice || (error ? '' : '同一时间可保存多个模型；以后可随时编辑、测试或删除。')}</span><button type="submit" className="nf-primary-button" disabled={busy !== ''}>{busy === 'save' ? <><LoaderCircle size={14} />保存中…</> : editingId ? '保存修改' : '保存模型配置'}</button></div>{error && <p className="nf-settings-error" role="alert">{error}</p>}</form></section>
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
