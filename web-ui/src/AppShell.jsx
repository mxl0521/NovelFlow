import { BarChart3, Bell, BookOpen, Bot, BookPlus, ChevronDown, Feather, FolderOpen, Home, Lightbulb, Menu, Search, Settings, UsersRound } from 'lucide-react'

const navigation = [
  { label: '首页', icon: Home, view: 'home' }, { label: '我的故事', icon: BookOpen, view: 'stories' }, { label: '新建创作', icon: BookPlus, action: 'create' },
  { label: '写作进度', icon: BarChart3, view: 'progress' }, { label: '灵感笔记', icon: Lightbulb, view: 'notes' }, { label: '角色库', icon: UsersRound, view: 'characters' }, { label: '世界设定', icon: FolderOpen, view: 'world' },
]

function progressFor(project) {
  if (!project?.chapters?.length) return 0
  return Math.round(project.chapters.filter((chapter) => String(chapter.body || '').trim()).length / project.chapters.length * 100)
}

function AppShell({ children, project, view = 'home', onNavigate, onOpenCreator, onOpenWritingRoom, onOpenAssistant, onOpenSearch, onOpenNotifications, onOpenProfile }) {
  const progress = progressFor(project)
  const currentTitle = project?.title || '还没有开始作品'
  return <div className="nf-app-shell">
    <aside className="nf-sidebar">
      <div className="nf-brand"><Feather size={26} strokeWidth={1.6} /><span>NovelFlow</span></div>
      <button className="nf-new-story" type="button" onClick={onOpenCreator}><BookPlus size={18} />新建故事</button>
      <nav className="nf-primary-nav" aria-label="主导航">{navigation.map(({ label, icon: Icon, view: targetView, action }) => <button key={label} className={`nf-nav-item ${targetView === view ? 'is-active' : ''}`} type="button" onClick={action === 'create' ? onOpenCreator : () => onNavigate?.(targetView)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></button>)}</nav>
      <div className="nf-nav-divider" />
      <nav className="nf-primary-nav nf-secondary-nav" aria-label="辅助导航"><button className={`nf-nav-item ${view === 'assistant' ? 'is-active' : ''}`} type="button" onClick={onOpenAssistant}><Bot size={18} strokeWidth={1.7} /><span>AI 助手</span></button><button className={`nf-nav-item ${view === 'stats' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate?.('stats')}><BarChart3 size={18} strokeWidth={1.7} /><span>数据统计</span></button><button className={`nf-nav-item ${view === 'settings' ? 'is-active' : ''}`} type="button" onClick={() => onNavigate?.('settings')}><Settings size={18} strokeWidth={1.7} /><span>设置</span></button></nav>
      <section className="nf-current-project" aria-label="当前故事"><span>当前故事</span><button type="button" className={`nf-project-cover ${project?.cover?.url ? 'has-cover' : ''}`} onClick={project ? onOpenWritingRoom : onOpenCreator} aria-label={project ? `打开${currentTitle}写作房间` : '新建故事'}>{project?.cover?.url ? <img src={project.cover.url} alt="" /> : <><i /><i /><i /></>}</button><strong>{currentTitle}</strong><small>{project?.genre || '从一句想法开始'} · {project ? '进行中' : '等待创作'}</small><div className="nf-progress-track"><i style={{ width: `${progress}%` }} /></div><div className="nf-progress-meta"><span>{project?.chapters?.length || 0} 章</span><span>{progress}%</span></div></section>
      <footer className="nf-user-row"><button type="button" className="nf-user-trigger" onClick={onOpenProfile}><span className="nf-avatar">墨</span><strong>墨染流年</strong><ChevronDown size={15} /></button><button type="button" title="切换显示模式" onClick={() => onNavigate?.('settings')}><Menu size={16} /></button></footer>
    </aside>
    <main className="nf-main-area"><header className="nf-topbar"><div><span>{view === 'home' ? '创作首页' : '创作工作台'}</span><strong>{view === 'home' ? '今天，想写一个怎样的故事？' : ({ stories: '我的故事', progress: '写作进度', notes: '灵感笔记', characters: '角色库', world: '世界设定', assistant: 'AI 助手', stats: '数据统计', settings: '设置', search: '搜索作品', notifications: '通知中心', profile: '账户菜单' }[view] || '创作工作台')}</strong></div><div className="nf-topbar-actions"><button type="button" title="打开搜索" onClick={onOpenSearch}><Search size={18} /></button><button type="button" title="打开通知" onClick={onOpenNotifications}><Bell size={18} /></button></div></header><section className="nf-workspace">{children}</section></main>
  </div>
}

export default AppShell
