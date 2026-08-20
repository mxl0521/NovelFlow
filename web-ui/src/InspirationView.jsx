import { Check, GitBranch, Lightbulb, MessageSquareText, PenLine, Sparkles, Users, Flag } from 'lucide-react'

function ContextItem({ icon: Icon, label, children }) {
  return <section className="context-card"><div className="context-label"><Icon size={14} />{label}</div><div className="context-value">{children}</div></section>
}

export default function InspirationView({
  busy,
  currentChapter,
  idea,
  onBack,
  onGenerate,
  onIdeaChange,
  onSelect,
  options,
  selectedId,
  storyMemory,
}) {
  return <section className="view-page" aria-label="灵感助手">
    <div className="view-head"><div><h1>灵感助手</h1><p>读取当前作品、章节目标、人物状态和伏笔，实时生成三套不同的剧情方向。</p></div><button type="button" className="button primary" onClick={onBack}><PenLine size={15} />回到正文</button></div>
    <form className="inspiration-generator" onSubmit={onGenerate}>
      <div><label htmlFor="inspiration-idea">你的想法 <span>可选</span></label><textarea id="inspiration-idea" value={idea} onChange={(event) => onIdeaChange(event.target.value)} maxLength="1000" placeholder="例如：我想让岑遥看似背叛沈砚，但真正目的是阻止他登上列车。没有想法也可以直接生成。" /></div>
      <button type="submit" className="button primary" disabled={busy}><Sparkles size={15} />{busy ? '正在读取作品并生成…' : '生成三个新方向'}</button>
    </form>
    <div className="idea-grid">{options.map((suggestion) => <button key={suggestion.id} type="button" className={`idea-card ${selectedId === suggestion.id ? 'selected' : ''}`} onClick={() => onSelect(suggestion)}><Lightbulb size={18} /><strong>{suggestion.title}</strong><span>{suggestion.body}</span>{suggestion.reason && <small>{suggestion.reason}</small>}{selectedId === suggestion.id && <Check size={16} />}</button>)}</div>
    <div className="inspiration-actions"><span>{selectedId ? '已选择一个方向，右侧输入框已准备好深化问题。' : '选择一个方向后，可交给阿流继续深化。'}</span><button type="button" className="button" onClick={() => document.querySelector('.assistant-input input')?.focus()}><MessageSquareText size={15} />继续问阿流</button></div>
    <section className="view-section"><div className="section-heading"><div><h2>当前章节创作约束</h2><p>这些信息会自动传给右侧创作助手和协同工作流。</p></div></div><div className="overview-grid"><ContextItem icon={Flag} label="章节目标">{currentChapter.goal || '推进本章冲突，并在结尾留下可追踪的钩子。'}</ContextItem><ContextItem icon={Users} label="人物设定">{storyMemory.characters?.length ? storyMemory.characters.map((item) => item.name).join('、') : '尚未补充人物卡'}</ContextItem><ContextItem icon={GitBranch} label="伏笔追踪">{storyMemory.foreshadows?.length ? `${storyMemory.foreshadows.length} 条进行中` : '尚未补充伏笔'}</ContextItem></div></section>
  </section>
}
