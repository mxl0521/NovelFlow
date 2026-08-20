import { BookOpen, CheckCircle2, GitBranch, Map, Users, X } from 'lucide-react'

function DossierList({ icon: Icon, title, items }) {
  return (
    <section className="dossier-section">
      <h3><Icon size={15} />{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}

function ProjectDossier({ project, projectKit, onClose }) {
  const mode = projectKit.mode === 'demo' ? '本地演示档案' : 'GPT 已生成档案'

  return (
    <div className="modal-backdrop dossier-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="project-dossier" role="dialog" aria-modal="true" aria-labelledby="dossier-title">
        <header className="dossier-head">
          <div><span>{mode}</span><h2 id="dossier-title">{project.title}</h2><p>{projectKit.synopsis}</p></div>
          <button type="button" className="icon-button" title="关闭作品档案" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="dossier-highlights">
          {projectKit.sellingPoints?.map((point) => <div key={point}><CheckCircle2 size={15} />{point}</div>)}
        </div>
        <div className="dossier-grid">
          <DossierList icon={Map} title="世界规则" items={projectKit.worldRules || []} />
          <DossierList icon={GitBranch} title="核心伏笔" items={projectKit.foreshadows || []} />
        </div>
        <section className="dossier-section dossier-characters">
          <h3><Users size={15} />人物卡</h3>
          <div className="character-list">{projectKit.characters?.map((character) => <div key={character.name}><strong>{character.name}</strong><span>{character.role}</span><p>{character.arc}</p></div>)}</div>
        </section>
        <div className="dossier-grid">
          <section className="dossier-section"><h3><BookOpen size={15} />分卷规划</h3><ol>{projectKit.volumes?.map((volume) => <li key={volume.title}><strong>{volume.title}</strong><span>{volume.goal}</span></li>)}</ol></section>
          <section className="dossier-section"><h3><BookOpen size={15} />已建章节</h3><ol>{projectKit.chapterPlan?.map((chapter) => <li key={chapter.id}><strong>{chapter.title}</strong><span>{chapter.goal}</span></li>)}</ol></section>
        </div>
        <footer className="dossier-foot"><span>第一章草稿与章节目标已写入作品。</span><button type="button" className="button primary" onClick={onClose}>进入写作房间</button></footer>
      </section>
    </div>
  )
}

export default ProjectDossier
