import { useEffect, useState } from 'react'
import { Check, RefreshCw, Sparkles } from 'lucide-react'

function BlueprintCard({ option, selected, onSelect }) {
  return (
    <button type="button" className={`blueprint-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className="blueprint-card-head">
        <span><strong>{option.title}</strong><em>{option.creativeDirection ? `${option.creativeDirection} · ${option.tagline}` : option.tagline}</em></span>
        {selected && <Check size={17} aria-label="已选中" />}
      </span>
      <span className="blueprint-summary">{option.synopsis}</span>
      <span className="blueprint-field"><b>核心钩子</b>{option.hook}</span>
      <span className="blueprint-field"><b>核心冲突</b>{option.coreConflict}</span>
      <span className="blueprint-field"><b>开篇方向</b>{option.openingDirection}</span>
      <span className="blueprint-outline"><b>故事骨架</b>{option.outline?.map((item) => <i key={item.title}>{item.title}</i>)}</span>
    </button>
  )
}

function ProjectBlueprintPicker({ blueprint, mode, busy, onRegenerate, onConfirm }) {
  const [selectedId, setSelectedId] = useState(blueprint.options[0]?.id || '')
  const [feedback, setFeedback] = useState('')
  const selected = blueprint.options.find((option) => option.id === selectedId) || blueprint.options[0]

  useEffect(() => setSelectedId(blueprint.options[0]?.id || ''), [blueprint])

  return (
    <div className="blueprint-view">
      <div className="wizard-step blueprint-intro">
        <h2>先选一个创作方向</h2>
        <p>{mode === 'fallback' ? '模型暂时没有返回完整结构，请检查配置后重试。' : '这三套方向由创作总编根据你的设定生成，并且分别采用不同的叙事重心。选定后才会创建作品，不满意可以继续调整。'}</p>
      </div>
      <div className="blueprint-grid">
        {blueprint.options.map((option) => <BlueprintCard key={option.id} option={option} selected={option.id === selectedId} onSelect={() => setSelectedId(option.id)} />)}
      </div>
      <div className="blueprint-actions">
        <label className="blueprint-feedback">
          <span>不满意？告诉创作总编要怎么改</span>
          <input value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength="1000" placeholder="例如：不要穿越，女主更有主见，悬疑感更强" />
        </label>
        <div className="blueprint-action-buttons">
          <button type="button" className="button" disabled={busy} onClick={() => onRegenerate('')}><RefreshCw size={15} />换一批</button>
          <button type="button" className="button" disabled={busy || !feedback.trim()} onClick={() => onRegenerate(feedback.trim())}><Sparkles size={15} />按要求重做</button>
          <button type="button" className="button primary" disabled={busy || !selected} onClick={() => onConfirm(selected)}><Check size={15} />创建全书规划 + 首章正文</button>
        </div>
      </div>
    </div>
  )
}

export default ProjectBlueprintPicker
