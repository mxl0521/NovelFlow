import { GitBranch, Users } from 'lucide-react'

function StoryMap({ characters = [], relationships = [] }) {
  const names = characters.map((item) => item.name).filter(Boolean)
  const visibleRelationships = relationships.filter((item) => item?.from && item?.to && item?.label)

  return (
    <section className="view-section story-map" aria-label="人物关系图">
      <div className="section-heading"><div><h2><GitBranch size={16} />人物关系图</h2><p>关系会同步给章节导演和协作 Agent，用来约束人物选择。</p></div><span className="story-map-count"><Users size={14} />{names.length} 人物 · {visibleRelationships.length} 关系</span></div>
      {names.length ? <div className="story-map-canvas">
        <div className="story-map-nodes">{names.map((name) => <span key={name}>{name}</span>)}</div>
        <div className="story-map-links">{visibleRelationships.length ? visibleRelationships.map((item, index) => <div key={`${item.from}-${item.to}-${index}`}><strong>{item.from}</strong><i>→</i><em>{item.label}</em><i>→</i><strong>{item.to}</strong>{item.note && <small>{item.note}</small>}</div>) : <p>在下方“人物关系”中添加关系后，这里会形成可追踪的关系链。</p>}</div>
      </div> : <p className="story-map-empty">先在人物卡中填写人物，关系图会自动生成节点。</p>}
    </section>
  )
}

export default StoryMap
