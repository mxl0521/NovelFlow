import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, GitBranch, Map, Sparkles, Users } from 'lucide-react'

function ListBlock({ icon: Icon, title, items = [] }) {
  return <section className="nf-overview-block"><h3><Icon size={16} />{title}</h3>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="nf-empty-copy">还没有记录，后续写作时可以继续补充。</p>}</section>
}

function ProjectOverviewPage({ project, onBack, onOpenWritingRoom }) {
  const kit = project?.memory?.project_kit || {}
  const chapters = Array.isArray(project?.chapters) ? project.chapters : []
  const characters = Array.isArray(kit.characters) ? kit.characters : []
  const volumes = Array.isArray(kit.volumes) ? kit.volumes : []
  const chapterPlan = Array.isArray(kit.chapterPlan) ? kit.chapterPlan : chapters.slice(0, 8).map((chapter) => ({ title: chapter.title, goal: chapter.goal, hook: chapter.hook }))
  const completed = chapters.filter((chapter) => ['已定稿', '已完成'].includes(chapter.status)).length
  const progress = chapters.length ? Math.round(completed / chapters.length * 100) : 0

  return <div className="nf-project-overview">
    <button type="button" className="nf-back-button" onClick={onBack}><ArrowLeft size={16} />返回首页</button>
    <section className="nf-project-hero"><div className="nf-project-hero-art nf-cover-mist"><i /><i /><i /></div><div className="nf-project-hero-copy"><span className="nf-project-kicker"><Sparkles size={14} />作品资料</span><h1>{project?.title || '未命名作品'}</h1><p>{kit.synopsis || '作品简介将在创作档案生成后显示。'}</p><div className="nf-project-meta"><span>{project?.genre || '未分类'}</span><span>{chapters.length} 章计划</span><span>作品创作档案</span></div><button type="button" className="nf-primary-button" onClick={onOpenWritingRoom}>进入写作房间<ArrowRight size={15} /></button></div></section>
    <section className="nf-project-progress"><div><span>创作进度</span><strong>{progress}%</strong></div><div className="nf-progress-track"><i style={{ width: `${progress}%` }} /></div><small>{completed} / {chapters.length || 0} 章已完成，第一章草稿已准备好</small></section>
    <section className="nf-overview-section"><div className="nf-section-heading"><div><h2>这部作品的核心</h2><p>阿流会把这些内容作为后续每一次生成的共同依据。</p></div></div><div className="nf-highlight-grid">{(kit.sellingPoints || []).map((point) => <div key={point}><CheckCircle2 size={16} />{point}</div>)}</div></section>
    <section className="nf-overview-grid"><ListBlock icon={Map} title="世界规则" items={kit.worldRules} /><ListBlock icon={GitBranch} title="核心伏笔" items={kit.foreshadows} /></section>
    <section className="nf-overview-section"><div className="nf-section-heading"><div><h2>人物卡</h2><p>先认识他们，再让他们自己推动剧情。</p></div></div><div className="nf-character-grid">{characters.map((character) => <article key={character.name}><div className="nf-character-avatar">{String(character.name || '人').slice(0, 1)}</div><div><h3>{character.name || '未命名人物'}</h3><span>{character.role || '关键人物'}</span><p>{character.arc || character.state || '人物弧线待补充。'}</p></div></article>)}</div></section>
    <section className="nf-overview-grid"><section className="nf-overview-block"><h3><BookOpen size={16} />分卷规划</h3>{volumes.length ? <ol>{volumes.map((volume) => <li key={volume.title}><strong>{volume.title}</strong><span>{volume.goal}</span></li>)}</ol> : <p className="nf-empty-copy">还没有分卷规划。</p>}</section><section className="nf-overview-block"><h3><BookOpen size={16} />开篇章节</h3>{chapterPlan.length ? <ol>{chapterPlan.slice(0, 8).map((chapter, index) => <li key={`${chapter.title}-${index}`}><strong>{chapter.title || `第 ${index + 1} 章`}</strong><span>{chapter.goal || chapter.beat || '章节目标待补充'}</span></li>)}</ol> : <p className="nf-empty-copy">还没有章节规划。</p>}</section></section>
    <section className="nf-overview-note"><Users size={17} /><span>阿流会在写作房间右侧持续陪你工作。你可以随时让它解释设定、补全情节或修改选中的文字。</span><button type="button" onClick={onOpenWritingRoom}>开始写第一章<ArrowRight size={14} /></button></section>
  </div>
}

export default ProjectOverviewPage
