import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'

const emptyArc = () => ({ id: crypto.randomUUID(), title: '', startChapter: '', endChapter: '', goal: '', midpoint: '', climax: '', payoff: '', status: '规划中' })
const emptyTimeline = () => ({ id: crypto.randomUUID(), chapterId: '', time: '', location: '', event: '', participants: '', consequence: '' })
const emptyEntity = () => ({ id: crypto.randomUUID(), name: '', summary: '', rules: '', firstChapter: '', lastChapter: '' })
const entityLabels = { locations: '地点', items: '物品', organizations: '组织', abilities: '能力体系' }

function StoryControlPanel({ memory, onSaved }) {
  const [tab, setTab] = useState('arcs')
  const [arcs, setArcs] = useState([])
  const [timeline, setTimeline] = useState([])
  const [entities, setEntities] = useState({ locations: [], items: [], organizations: [], abilities: [] })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setArcs(Array.isArray(memory?.story_arcs) ? memory.story_arcs : [])
    setTimeline(Array.isArray(memory?.timeline) ? memory.timeline : [])
    setEntities({ locations: [], items: [], organizations: [], abilities: [], ...(memory?.entities || {}) })
  }, [memory])

  function updateList(setter, index, key, value) {
    setter((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }

  function updateEntity(type, index, key, value) {
    setEntities((current) => ({ ...current, [type]: current[type].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  }

  async function save() {
    setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/project/story-control/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyArcs: arcs, timeline, entities }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '保存失败')
      onSaved?.({ story_arcs: payload.storyArcs, timeline: payload.timeline, entities: payload.entities })
      setMessage('剧情控制数据已保存，AI 编辑团队会自动读取。')
    } catch (error) { setMessage(error.message || '保存失败') } finally { setBusy(false) }
  }

  return (
    <section className="view-section story-control-panel" aria-label="长篇剧情控制">
      <div className="section-heading"><div><h2>长篇剧情控制</h2><p>管理逐章大纲之上的剧情弧、时间因果和实体规则。</p></div><button type="button" className="button primary" disabled={busy} onClick={save}><Save size={15} />{busy ? '保存中…' : '保存剧情控制'}</button></div>
      <div className="story-control-tabs" role="tablist">{[['arcs', '剧情弧'], ['timeline', '时间线'], ['entities', '实体资料库']].map(([id, label]) => <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)}>{label}</button>)}</div>
      {tab === 'arcs' && <div className="story-control-list"><div className="story-control-toolbar"><span>每条剧情弧连接若干章节，明确中点、高潮和回收。</span><button type="button" className="button quiet" onClick={() => setArcs((items) => [...items, emptyArc()])}><Plus size={14} />添加剧情弧</button></div>{arcs.length === 0 && <p className="story-control-empty">还没有剧情弧。长篇作品建议先建立第一卷的主剧情弧。</p>}{arcs.map((arc, index) => <article key={arc.id || index}><header><strong>{arc.title || `剧情弧 ${index + 1}`}</strong><button type="button" className="icon-button" title="删除剧情弧" onClick={() => setArcs((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></header><div className="story-control-grid"><label>名称<input value={arc.title} onChange={(event) => updateList(setArcs, index, 'title', event.target.value)} /></label><label>状态<select value={arc.status} onChange={(event) => updateList(setArcs, index, 'status', event.target.value)}>{['规划中', '进行中', '已完成', '已暂停'].map((item) => <option key={item}>{item}</option>)}</select></label><label>起始章节<input value={arc.startChapter} onChange={(event) => updateList(setArcs, index, 'startChapter', event.target.value)} placeholder="01" /></label><label>结束章节<input value={arc.endChapter} onChange={(event) => updateList(setArcs, index, 'endChapter', event.target.value)} placeholder="30" /></label><label className="wide">阶段目标<textarea value={arc.goal} onChange={(event) => updateList(setArcs, index, 'goal', event.target.value)} /></label><label>中点转折<textarea value={arc.midpoint} onChange={(event) => updateList(setArcs, index, 'midpoint', event.target.value)} /></label><label>高潮<textarea value={arc.climax} onChange={(event) => updateList(setArcs, index, 'climax', event.target.value)} /></label><label>最终回收<textarea value={arc.payoff} onChange={(event) => updateList(setArcs, index, 'payoff', event.target.value)} /></label></div></article>)}</div>}
      {tab === 'timeline' && <div className="story-control-list"><div className="story-control-toolbar"><span>记录发生时间、地点、参与者和后果，避免前后因果冲突。</span><button type="button" className="button quiet" onClick={() => setTimeline((items) => [...items, emptyTimeline()])}><Plus size={14} />添加事件</button></div>{timeline.length === 0 && <p className="story-control-empty">还没有时间线事件。</p>}{timeline.map((item, index) => <article key={item.id || index}><header><strong>{item.event || `事件 ${index + 1}`}</strong><button type="button" className="icon-button" title="删除事件" onClick={() => setTimeline((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></button></header><div className="story-control-grid"><label>章节<input value={item.chapterId} onChange={(event) => updateList(setTimeline, index, 'chapterId', event.target.value)} /></label><label>故事时间<input value={item.time} onChange={(event) => updateList(setTimeline, index, 'time', event.target.value)} /></label><label>地点<input value={item.location} onChange={(event) => updateList(setTimeline, index, 'location', event.target.value)} /></label><label>参与者<input value={item.participants} onChange={(event) => updateList(setTimeline, index, 'participants', event.target.value)} /></label><label className="wide">事件<textarea value={item.event} onChange={(event) => updateList(setTimeline, index, 'event', event.target.value)} /></label><label className="wide">后果<textarea value={item.consequence} onChange={(event) => updateList(setTimeline, index, 'consequence', event.target.value)} /></label></div></article>)}</div>}
      {tab === 'entities' && <div className="entity-sections">{Object.entries(entityLabels).map(([type, label]) => <section key={type}><div className="story-control-toolbar"><strong>{label}</strong><button type="button" className="button quiet" onClick={() => setEntities((current) => ({ ...current, [type]: [...current[type], emptyEntity()] }))}><Plus size={14} />添加{label}</button></div>{entities[type].map((item, index) => <article key={item.id || index}><header><strong>{item.name || `${label} ${index + 1}`}</strong><button type="button" className="icon-button" title={`删除${label}`} onClick={() => setEntities((current) => ({ ...current, [type]: current[type].filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} /></button></header><div className="story-control-grid"><label>名称<input value={item.name} onChange={(event) => updateEntity(type, index, 'name', event.target.value)} /></label><label>首次出现<input value={item.firstChapter} onChange={(event) => updateEntity(type, index, 'firstChapter', event.target.value)} /></label><label>最近出现<input value={item.lastChapter} onChange={(event) => updateEntity(type, index, 'lastChapter', event.target.value)} /></label><label className="wide">说明<textarea value={item.summary} onChange={(event) => updateEntity(type, index, 'summary', event.target.value)} /></label><label className="wide">规则与限制<textarea value={item.rules} onChange={(event) => updateEntity(type, index, 'rules', event.target.value)} /></label></div></article>)}</section>)}</div>}
      {message && <p className="story-control-message" role="status">{message}</p>}
    </section>
  )
}

export default StoryControlPanel
