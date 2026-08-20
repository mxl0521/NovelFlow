import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, Clock3, Lightbulb, LoaderCircle, MessageSquare, Sparkles, Square, X } from 'lucide-react'
import ProjectBlueprintPicker from './ProjectBlueprintPicker'

const genres = [
  { id: 'xuanhuan', label: '玄幻升级' }, { id: 'urban', label: '都市现实' }, { id: 'mystery', label: '悬疑推理' },
  { id: 'modern_romance', label: '言情情感' }, { id: 'scifi', label: '科幻脑洞' }, { id: 'power', label: '历史权谋' },
  { id: 'apocalypse', label: '末世求生' }, { id: 'farming', label: '种田经营' },
]
const styles = [
  { id: 'fast', label: '爽感强' }, { id: 'hook', label: '悬念强' }, { id: 'cinematic', label: '画面感强' },
  { id: 'comedy', label: '轻松幽默' }, { id: 'logic', label: '硬核严谨' }, { id: 'slow', label: '沉浸慢热' },
]
const lengths = {
  short: { label: '短篇', hint: '一个核心事件，8 章以内', chapterCount: 8, wordsPerChapter: 2000 },
  medium: { label: '中篇', hint: '完整人物弧光，约 40 章', chapterCount: 40, wordsPerChapter: 2500 },
  long: { label: '长篇', hint: '分卷推进，约 120 章起', chapterCount: 120, wordsPerChapter: 3000 },
}

function Choice({ children, selected, onClick }) {
  return <button type="button" className={`quick-choice ${selected ? 'selected' : ''}`} onClick={onClick}>{children}{selected && <Check size={14} />}</button>
}

function QuickCreateModal({ onClose, onProfessional, onClarify, onGenerate, onCreate, initialIdea = '', initialGenre = '', initialLengthMode = 'long', initialStyle = '' }) {
  const [idea, setIdea] = useState(initialIdea)
  const [genre, setGenre] = useState(initialGenre)
  const [customGenre, setCustomGenre] = useState('')
  const [direction, setDirection] = useState('不限')
  const [style, setStyle] = useState(initialStyle)
  const [lengthMode, setLengthMode] = useState(initialLengthMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState(null)
  const [answers, setAnswers] = useState({})
  const [blueprint, setBlueprint] = useState(null)
  const [mode, setMode] = useState('demo')
  const [busyTask, setBusyTask] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const generationController = useRef(null)

  useEffect(() => {
    if (!busyTask) { setElapsedSeconds(0); return undefined }
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [busyTask])

  const progressInfo = useMemo(() => {
    if (busyTask === 'questions') return { title: '正在理解故事想法', detail: 'AI 正在整理最关键的创作追问。', percent: Math.min(90, 18 + elapsedSeconds * 5) }
    if (busyTask === 'create') return { title: '正在创建作品档案', detail: '正在保存人物、世界观、章节计划和长期记忆。', percent: Math.min(92, 20 + elapsedSeconds * 4) }
    const detail = elapsedSeconds < 6
      ? '正在检查题材、篇幅和补充答案。'
      : elapsedSeconds < 45
        ? '正在等待 GPT 生成三套不同的故事方向。完整人物和大纲通常需要 30～90 秒。'
        : '中转站响应较慢；后端遇到 502 会自动重试，失败时会返回可编辑的本地方案。'
    return { title: '正在生成 3 套故事方案', detail, percent: Math.min(92, 12 + elapsedSeconds * 1.35) }
  }, [busyTask, elapsedSeconds])

  const settings = useMemo(() => {
    const length = lengths[lengthMode]
    return {
      title: '', premise: idea.trim(), genre: customGenre.trim() || genres.find((item) => item.id === genre)?.label || '不限题材', direction,
      themePack: customGenre.trim() ? '' : genre, audiencePack: direction === '男频' ? 'male_upgrade' : direction === '女频' ? 'female_emotion' : '', stylePacks: style ? [style] : [],
      tags: [customGenre.trim() || genres.find((item) => item.id === genre)?.label, styles.find((item) => item.id === style)?.label].filter(Boolean),
      chapterCount: length.chapterCount, wordsPerChapter: length.wordsPerChapter, lengthMode, lengthModeSource: 'manual', pov: '第三人称', updateRhythm: '日更', ending: lengthMode === 'short' ? '反转型' : '成长型',
    }
  }, [customGenre, direction, genre, idea, lengthMode, style])

  async function askQuestions() {
    if (idea.trim().length < 6) { setError('先写下一句故事想法，至少 6 个字即可。'); return }
    setBusy(true); setBusyTask('questions'); setError('')
    try {
      const result = await onClarify(settings)
      if (!Array.isArray(result?.questions) || result.questions.length < 3) throw new Error('灵感追问暂时不可用，请重试')
      const compactQuestions = result.questions.slice(0, 4)
      setQuestions(compactQuestions)
      setAnswers(Object.fromEntries(compactQuestions.map((question) => [question.id, ''])))
    } catch (requestError) { setError(requestError.message || '灵感追问暂时不可用，请重试') } finally { setBusy(false); setBusyTask('') }
  }

  async function generate(feedback = '', settingsOverride = settings) {
    const controller = new AbortController()
    generationController.current = controller
    setBusy(true); setBusyTask('blueprint'); setError('')
    try {
      const result = await onGenerate(settingsOverride, feedback, { signal: controller.signal })
      if (!result?.blueprint?.options?.length) throw new Error('故事方案生成失败，请重试')
      setBlueprint(result.blueprint); setMode(result.mode || 'demo')
    } catch (generationError) {
      setError(generationError.name === 'AbortError' ? '已停止生成。你的输入仍然保留，可以调整后重新生成。' : (generationError.message || '故事方案生成失败，请重试'))
    } finally {
      generationController.current = null
      setBusy(false); setBusyTask('')
    }
  }

  function stopGeneration() {
    generationController.current?.abort()
  }

  function withAnswers() {
    const clarifications = questions?.map((question) => `${question.label}：${answers[question.id]?.trim() || '由创作总编按故事想法判断'}`) || []
    return { ...settings, clarifications }
  }

  async function confirm(option) {
    setBusy(true); setBusyTask('create'); setError('')
    try { if (await onCreate(withAnswers(), option)) onClose() } catch (creationError) { setError(creationError.message || '作品创建失败，请重试') } finally { setBusy(false); setBusyTask('') }
  }

  return (
    <div className="wizard-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="quick-create" role="dialog" aria-modal="true" aria-labelledby="quick-create-title">
        <header className="wizard-head quick-create-head"><div><div className="wizard-title"><Sparkles size={17} />快速创作</div><p id="quick-create-title">一句想法也可以开始。AI 会给出 3 个方向，并创建全书规划与第一章正文。</p>{initialIdea && <div className="quick-create-source"><MessageSquare size={13} />已从 AI 创作助手预填 · 你可以继续修改，确认后才会生成</div>}</div><button type="button" className="icon-button" title="关闭快速创作" disabled={busy} onClick={onClose}><X size={17} /></button></header>
        <div className={`quick-create-body ${busy ? 'is-busy' : ''}`}>
          {busy && <section className="quick-generation-progress" aria-live="polite"><div className="quick-progress-icon"><LoaderCircle size={28} /></div><div><span className="quick-progress-kicker"><Clock3 size={13} />已等待 {elapsedSeconds} 秒</span><h2>{progressInfo.title}</h2><p>{progressInfo.detail}</p></div><div className="quick-progress-track" aria-label={`生成进度约 ${Math.round(progressInfo.percent)}%`}><i style={{ width: `${progressInfo.percent}%` }} /></div><ol><li className="done"><Check size={13} /><span>读取你的故事想法与选项</span></li><li className={busyTask === 'create' ? 'done' : 'active'}><LoaderCircle size={13} /><span>{busyTask === 'questions' ? '整理关键追问' : '调用模型生成内容'}</span></li><li className={busyTask === 'create' ? 'active' : ''}><span>3</span><span>{busyTask === 'create' ? '保存作品与长期记忆' : '校验人物、冲突和大纲结构'}</span></li></ol>{busyTask === 'blueprint' && <button type="button" className="button" onClick={stopGeneration}><Square size={13} />停止生成</button>}</section>}
          {blueprint ? <ProjectBlueprintPicker blueprint={blueprint} mode={mode} busy={busy} onRegenerate={generate} onConfirm={confirm} /> : questions ? <div className="quick-clarifications"><div className="quick-step-title"><Lightbulb size={18} /><div><h2>再补几条关键信息</h2><p>选择接近的选项，或直接写下你的想法。答案会影响接下来的故事方向。</p></div></div>{questions.map((question) => <section className="quick-question" key={question.id}><label>{question.label}</label>{question.options?.length > 0 && <div className="quick-choice-grid">{question.options.map((option) => <Choice key={option} selected={answers[question.id] === option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}>{option}</Choice>)}</div>}<input aria-label={question.label} value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={question.placeholder || '也可以直接写下你的想法'} /></section>)}</div> : <div className="quick-start"><div className="quick-step-title"><Lightbulb size={20} /><div><h2>你想写一个怎样的故事？</h2><p>不用会写大纲。先把脑海里的画面、人物或冲突说出来。</p></div></div><label className="quick-idea-label">故事想法<textarea autoFocus value={idea} onChange={(event) => setIdea(event.target.value)} maxLength="2000" placeholder="例如：一个只能看见别人记忆最后十秒的女孩，为救失踪的哥哥，必须进入每个嫌疑人的记忆……" /></label><section className="quick-options"><label>题材（可选）</label><div className="quick-choice-grid">{genres.map((item) => <Choice key={item.id} selected={genre === item.id && !customGenre} onClick={() => { setGenre((current) => current === item.id ? '' : item.id); setCustomGenre('') }}>{item.label}</Choice>)}</div><input value={customGenre} maxLength="80" onChange={(event) => { setCustomGenre(event.target.value); if (event.target.value) setGenre('') }} placeholder="没有合适的？输入自定义题材，例如：民俗志怪探案" /></section><section className="quick-options"><label>读者方向（可选）</label><div className="quick-choice-grid">{['不限', '男频', '女频'].map((item) => <Choice key={item} selected={direction === item} onClick={() => setDirection(item)}>{item}</Choice>)}</div></section><section className="quick-options"><label>想要的感觉（可选）</label><div className="quick-choice-grid">{styles.map((item) => <Choice key={item.id} selected={style === item.id} onClick={() => setStyle((current) => current === item.id ? '' : item.id)}>{item.label}</Choice>)}</div></section><section className="quick-options"><label>篇幅</label><div className="quick-length-grid">{Object.entries(lengths).map(([id, item]) => <button key={id} type="button" className={`quick-length ${lengthMode === id ? 'selected' : ''}`} onClick={() => setLengthMode(id)}><strong>{item.label}</strong><span>{item.hint}</span>{lengthMode === id && <Check size={15} />}</button>)}</div></section></div>}
          {error && <p className="wizard-error" role="alert">{error}</p>}
        </div>
        <footer className="wizard-foot quick-create-foot">{busy ? <><span>{progressInfo.detail}</span>{busyTask === 'blueprint' && <button type="button" className="button" onClick={stopGeneration}><Square size={13} />停止生成</button>}</> : blueprint ? <><span>系统会创建完整章节树与全书规划，只生成第一章正文；后续章节按前文和长期记忆逐章生成。</span><button type="button" className="button" onClick={() => setBlueprint(null)}><ArrowLeft size={15} />返回修改</button></> : questions ? <><span>只需回答你愿意回答的部分</span><div><button type="button" className="button" onClick={() => setQuestions(null)}><ArrowLeft size={15} />返回想法</button><button type="button" className="button primary" onClick={() => generate('', withAnswers())}><Sparkles size={15} />生成 3 个方向</button></div></> : <><button type="button" className="text-button" onClick={onProfessional}>我想自己深度设定</button><button type="button" className="button primary" onClick={askQuestions}><Sparkles size={15} />帮我想 3 个故事方向</button></>}</footer>
      </section>
    </div>
  )
}

export default QuickCreateModal
