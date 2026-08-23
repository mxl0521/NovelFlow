import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, GitBranch, LoaderCircle, Map, RefreshCw, Sparkles, Users } from 'lucide-react'
import { refreshStoryDossier } from './api.js'

function chapterWords(chapter) { return String(chapter?.body || '').replace(/\s/g, '').length }
function sourceLabel(value) { return Array.isArray(value) ? value.filter(Boolean).join('、') : String(value || '').trim() }

function DossierList({ icon: Icon, title, items = [], empty = '保存章节后从正文整理。' }) {
  return <section className="nf-overview-block"><h3><Icon size={16} />{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={`${item.title || item.name || item}-${index}`}><strong>{item.title || item.name || item}</strong>{(item.content || item.note || item.summary) && <span>{item.content || item.note || item.summary}</span>}{(item.sourceChapters || item.status) && <small>{sourceLabel(item.sourceChapters)}{item.status ? ` · ${item.status}` : ''}</small>}</li>)}</ul> : <p className="nf-empty-copy">{empty}</p>}</section>
}

function ProjectOverviewPage({ project, onBack, onOpenWritingRoom, onProjectRefresh }) {
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState('')
  const memory = project?.memory || {}
  const kit = memory.project_kit || {}
  const dossier = memory.story_dossier || {}
  const chapters = Array.isArray(project?.chapters) ? project.chapters : []
  const written = chapters.filter((chapter) => String(chapter.body || '').trim()).length
  const progress = chapters.length ? Math.round(written / chapters.length * 100) : 0
  const worldFacts = Array.isArray(dossier.worldFacts) ? dossier.worldFacts : []
  const characters = Array.isArray(dossier.characters) ? dossier.characters : []
  const foreshadows = Array.isArray(dossier.foreshadows) ? dossier.foreshadows : []
  const initialRules = Array.isArray(kit.worldRules) ? kit.worldRules : []
  const synopsis = dossier.synopsis || kit.synopsis || '保存章节后，阿流会从正文整理作品简介。'
  const updatedThrough = dossier.updatedThroughChapter || memory.story_dossier_meta?.updatedThroughChapter || ''
  const syncText = syncing ? '资料同步中…' : updatedThrough ? `资料已同步至第 ${Number(updatedThrough)} 章` : '资料尚未从正文同步'
  const chapterSummary = useMemo(() => memory.chapter_summaries || {}, [memory.chapter_summaries])

  async function syncDossier() {
    if (syncing || !chapters.length) return
    setSyncing(true); setNotice('')
    try {
      const response = await refreshStoryDossier(chapters.at(-1)?.id || '')
      onProjectRefresh?.({ ...project, memory: response.memory || { ...memory, story_dossier: response.dossier } })
      setNotice(`已根据第 ${response.dossier?.updatedThroughChapter || chapters.at(-1)?.id || ''} 章正文更新资料。`)
    } catch (error) { setNotice(error.message || '资料同步失败，正文不受影响。') } finally { setSyncing(false) }
  }

  return <div className="nf-project-overview">
    <button type="button" className="nf-back-button" onClick={onBack}><ArrowLeft size={16} />返回首页</button>
    <section className="nf-project-hero"><div className="nf-project-hero-art nf-cover-mist"><i /><i /><i /></div><div className="nf-project-hero-copy"><span className="nf-project-kicker"><Sparkles size={14} />作品资料</span><h1>{project?.title || '未命名作品'}</h1><p>{synopsis}</p><div className="nf-project-meta"><span>{project?.genre || '未分类'}</span><span>{chapters.length} 章已建立</span><span>{syncText}</span></div><button type="button" className="nf-primary-button" onClick={onOpenWritingRoom}>进入写作房间<ArrowRight size={15} /></button></div></section>
    <section className="nf-project-progress"><div><span>创作进度</span><strong>{progress}%</strong></div><div className="nf-progress-track"><i style={{ width: `${progress}%` }} /></div><small>{written} / {chapters.length || 0} 章已有正文</small></section>
    <section className="nf-overview-note nf-dossier-sync-note"><CheckCircle2 size={17} /><span>{notice || (updatedThrough ? `资料卡以已保存正文为准，最近同步到第 ${Number(updatedThrough)} 章。` : '当前页面仍显示初始规划；点击同步后，资料卡会改为真实正文事实。')}</span><button type="button" onClick={syncDossier} disabled={syncing || !chapters.length}>{syncing ? <><LoaderCircle size={14} />同步中</> : <><RefreshCw size={14} />从正文更新资料</>}</button></section>
    <section className="nf-overview-section"><div className="nf-section-heading"><div><h2>当前故事状态</h2><p>真实正文优先，初始规划只作为参考。</p></div></div><div className="nf-highlight-grid"><div><CheckCircle2 size={16} /><span><strong>故事阶段</strong>{dossier.storyPhase || '同步后由正文整理'}</span></div><div><CheckCircle2 size={16} /><span><strong>当前状态</strong>{dossier.currentState || '保存章节后生成当前冲突状态'}</span></div><div><CheckCircle2 size={16} /><span><strong>资料来源</strong>{updatedThrough ? `第 1–${Number(updatedThrough)} 章正文` : '尚未建立正文资料档案'}</span></div></div></section>
    <section className="nf-overview-grid"><DossierList icon={Map} title="世界事实与创作约束" items={worldFacts} empty={initialRules.length ? '这是创建时的初始规划，点击同步后会替换为正文事实。' : undefined} /><DossierList icon={GitBranch} title="核心伏笔追踪" items={foreshadows} empty="保存章节后从正文提取伏笔，并记录首次出现和最近推进章节。" /></section>
    {worldFacts.length === 0 && initialRules.length > 0 && <section className="nf-overview-note nf-dossier-plan-note"><Map size={17} /><span>初始世界规划仍保留在档案中，但不会冒充已验证事实：{initialRules.slice(0, 2).join('；')}</span></section>}
    <section className="nf-overview-section"><div className="nf-section-heading"><div><h2>人物卡</h2><p>根据已保存正文更新，不再显示固定占位人物。</p></div></div><div className="nf-character-grid">{characters.length ? characters.map((character) => <article key={character.name}><div className="nf-character-avatar">{String(character.name || '人').slice(0, 1)}</div><div><h3>{character.name}</h3><span>{character.role || '人物'}</span><p>{character.state || character.relationship || '状态将在后续章节同步。'}</p><small className="nf-dossier-source">最近出现：第 {character.lastChapter || '—'} 章</small></div></article>) : <div className="nf-empty-panel"><Users size={18} /><span>资料尚未同步出真实人物。点击上方“从正文更新资料”，阿流会从章节正文整理。</span></div>}</div></section>
    <section className="nf-overview-section"><div className="nf-section-heading"><div><h2>实际章节</h2><p>标题、字数和状态均来自已保存章节，不再读取旧章节规划。</p></div><button type="button" className="nf-text-button" onClick={onOpenWritingRoom}>打开写作房间<ArrowRight size={14} /></button></div><div className="nf-chapter-list">{chapters.length ? chapters.map((chapter, index) => <button type="button" className="nf-dossier-chapter-row" key={chapter.id} onClick={onOpenWritingRoom}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{String(chapter.title || `第 ${index + 1} 章`).replace(/^第\s*\d+\s*章\s*[·.、:-]?\s*/, '')}</strong><small>{chapter.status || (String(chapter.body || '').trim() ? '草稿' : '待写')} · {chapterSummary[chapter.id] ? '已有摘要' : '正文记录'}</small></div><em>{chapterWords(chapter).toLocaleString('zh-CN')} 字</em><ArrowRight size={14} /></button>) : <p className="nf-empty-copy">还没有章节。</p>}</div></section>
  </div>
}

export default ProjectOverviewPage
