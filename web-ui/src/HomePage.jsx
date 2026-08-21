import { useState } from 'react'
import { ArrowUp, Bot, FilePlus2, MessageCircleMore, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { fetchProjectTrash, removeProject, restoreProject } from './api.js'

const wordCount = (project) => project?.chapters?.reduce((total, chapter) => total + String(chapter.body || '').replace(/\s/g, '').length, 0) || 0
const completedCount = (project) => project?.chapters?.filter((chapter) => chapter.status === '已定稿' || chapter.status === '已完成').length || 0

function StoryCard({ item, index, onOpen, onDelete }) {
  if (!item?.id) return null
  const tones = ['nf-cover-mist', 'nf-cover-tower', 'nf-cover-moon']
  const progress = item.chapterCount ? [32, 56, 18][index % 3] : 0
  return <article className="nf-story-card"><button type="button" className="nf-story-open" onClick={() => onOpen(item.id)}><span className={`nf-story-art ${tones[index % tones.length]}`} aria-hidden="true"><i /><i /><i /></span><strong>{item.title || '未命名作品'}</strong><small>{item.genre || '未分类'} · {item.chapterCount || 0} 章</small><div><i style={{ width: `${progress}%` }} /><em>{progress}%</em></div></button><button type="button" className="nf-story-delete" title="移入回收站" aria-label={`删除${item.title || '作品'}`} onClick={(event) => { event.stopPropagation(); onDelete(item) }}><Trash2 size={14} /></button></article>
}

function HomePage({ project, projects, loading, error, onRetry, onCreate, onOpenProject, onOpenWritingRoom, onProjectsChanged }) {
  const [idea, setIdea] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)
  const [trashItems, setTrashItems] = useState([])
  const [trashBusy, setTrashBusy] = useState('')
  const [trashError, setTrashError] = useState('')
  async function openTrash() {
    setTrashOpen(true); setTrashBusy('load'); setTrashError('')
    try { const response = await fetchProjectTrash(); setTrashItems(response.projects || []) } catch (requestError) { setTrashError(requestError.message || '无法读取作品回收站') } finally { setTrashBusy('') }
  }
  async function moveToTrash(item) {
    if (!window.confirm(`删除「${item.title || '未命名作品'}」？作品会移入回收站，可随时恢复。`)) return
    setTrashBusy(`delete:${item.id}`); setTrashError('')
    try { await removeProject(item.id); await onProjectsChanged?.(item.id) } catch (requestError) { setTrashError(requestError.message || '删除作品失败') } finally { setTrashBusy('') }
  }
  async function restoreFromTrash(item) {
    setTrashBusy(`restore:${item.id}`); setTrashError('')
    try { await restoreProject(item.id); setTrashItems((current) => current.filter((entry) => entry.id !== item.id)); await onProjectsChanged?.(item.id) } catch (requestError) { setTrashError(requestError.message || '恢复作品失败') } finally { setTrashBusy('') }
  }
  return <div className="nf-home">
    <section className="nf-home-intro"><div><h1>下午好，墨染流年</h1><p>今天可以从一句话开始，阿流会帮你把它变成可写的方向。</p></div><blockquote>“故事不会凭空出现，<br />只有你能让它发生。”</blockquote></section>
    <section className="nf-ai-quick" aria-labelledby="nf-ai-quick-title"><div className="nf-ai-quick-head"><span className="nf-ai-orb"><Bot size={18} /></span><div><h2 id="nf-ai-quick-title">和阿流一起开始</h2><p>说出一个画面、人物或冲突，它会帮你找到第一条故事线。</p></div></div><form onSubmit={(event) => { event.preventDefault(); onCreate(idea.trim()) }}><label className="sr-only" htmlFor="quick-idea">故事想法</label><input id="quick-idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="告诉阿流你的想法，或者问问当前作品……" /><button type="submit" title="开始创作"><ArrowUp size={18} /></button></form><div className="nf-ai-prompts"><button type="button" onClick={() => onCreate('我想写一个关于时间循环的悬疑故事')}><Sparkles size={14} />生成 3 个故事方向</button><button type="button" onClick={() => onCreate('请帮我扩展两个主角之间的核心关系')}><MessageCircleMore size={14} />扩展人物关系</button><button type="button" onClick={() => onCreate('我需要一个能推动后续剧情的章节钩子')}><FilePlus2 size={14} />设计章节钩子</button></div></section>
    <section className="nf-overview" aria-labelledby="nf-overview-title"><h2 id="nf-overview-title">写作概览</h2><div className="nf-stat-grid"><article><span>创作中</span><strong>{projects.length}</strong><small>个故事</small></article><article><span>已完成章节</span><strong>{completedCount(project)}</strong><small>章</small></article><article><span>总字数</span><strong>{wordCount(project).toLocaleString('zh-CN')}</strong><small>字</small></article><article><span>创作天数</span><strong>{project ? 1 : 0}</strong><small>天</small></article></div></section>
    <section className="nf-recent-section" aria-labelledby="nf-recent-title"><div className="nf-section-heading"><div><h2 id="nf-recent-title">最近打开的故事</h2><p>{loading ? '正在读取作品…' : '继续写作，或从一个新想法开始。'}</p></div><div className="nf-section-actions">{project && <button type="button" onClick={onOpenWritingRoom}>继续创作</button>}<button type="button" onClick={openTrash}><Trash2 size={14} />回收站</button></div></div>{error && <div className="nf-data-notice"><span>{error}</span><button type="button" onClick={onRetry}>重新读取</button></div>}<div className="nf-story-grid">{projects.map((item, index) => <StoryCard key={item.id} item={item} index={index} onOpen={onOpenProject} onDelete={moveToTrash} />)}<button type="button" className="nf-new-story-card" onClick={() => onCreate('')}><span>＋</span><strong>新建故事</strong><small>从一个想法开始</small></button></div></section>
    {trashOpen && <div className="nf-project-trash-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTrashOpen(false)}><section className="nf-project-trash" role="dialog" aria-modal="true" aria-labelledby="project-trash-title"><header><div><span>作品管理</span><h2 id="project-trash-title">回收站</h2></div><button type="button" title="关闭回收站" onClick={() => setTrashOpen(false)}><X size={17} /></button></header><p>删除的作品会保留在这里，恢复后作品和章节内容都会回到工作台。</p><div className="nf-project-trash-list">{trashBusy === 'load' ? <p>正在读取回收站…</p> : trashItems.length ? trashItems.map((item) => <article key={item.id}><div><strong>{item.title || '未命名作品'}</strong><span>删除于 {item.deleted_at ? new Date(item.deleted_at).toLocaleString('zh-CN') : '未知时间'}</span></div><button type="button" onClick={() => restoreFromTrash(item)} disabled={Boolean(trashBusy)}>{trashBusy === `restore:${item.id}` ? '恢复中…' : <><RotateCcw size={14} />恢复作品</>}</button></article>) : <p>回收站为空。</p>}</div>{trashError && <p className="nf-project-trash-error" role="alert">{trashError}</p>}</section></div>}
  </div>
}

export default HomePage
