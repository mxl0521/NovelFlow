import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react'
import ProjectBlueprintPicker from './ProjectBlueprintPicker'

const steps = ['题材组合', '故事方向', '主角与人物', '冲突与关系', '篇幅与节奏', '写作偏好']
const lengthModes = [
  { id: 'short', label: '短篇', hint: '聚焦一个核心事件、强冲突和明确结尾' },
  { id: 'medium', label: '中篇', hint: '完整人物弧光、阶段转折和有限伏笔' },
  { id: 'long', label: '长篇', hint: '分卷规划、长期记忆、人物与伏笔持续追踪' },
]

function suggestedLengthMode(chapterCount, wordsPerChapter) {
  const estimatedWords = Number(chapterCount || 0) * Number(wordsPerChapter || 0)
  if (estimatedWords <= 30_000) return 'short'
  if (estimatedWords <= 150_000) return 'medium'
  return 'long'
}

const fallbackLayers = {
  themePacks: { options: [{ id: 'xuanhuan', label: '玄幻升级' }, { id: 'urban', label: '都市现实' }, { id: 'mystery', label: '悬疑推理' }, { id: 'modern_romance', label: '现言情感' }] },
  audiencePacks: { options: [{ id: 'male_upgrade', label: '男频升级' }, { id: 'female_emotion', label: '女频情感' }, { id: 'no_cp', label: '无 CP 成长' }] },
  mechanicPacks: { options: [{ id: 'system', label: '系统' }, { id: 'rebirth', label: '重生' }, { id: 'transmigration', label: '穿越' }, { id: 'detective', label: '探案' }] },
  stylePacks: { options: [{ id: 'fast', label: '爽文快节奏' }, { id: 'slow', label: '慢热沉浸' }, { id: 'hook', label: '强钩子' }, { id: 'logic', label: '硬核逻辑' }] },
}

function Choice({ value, selected, onClick }) {
  return <button type="button" className={`wizard-choice ${selected ? 'selected' : ''}`} onClick={onClick}>{value}{selected && <Check size={14} />}</button>
}

function NewProjectWizard({ creativeOptions, onClose, onClarify, onGenerate, onCreate }) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [blueprint, setBlueprint] = useState(null)
  const [mode, setMode] = useState('demo')
  const [error, setError] = useState('')
  const [clarifyingQuestions, setClarifyingQuestions] = useState(null)
  const [clarificationAnswers, setClarificationAnswers] = useState({})
  const [form, setForm] = useState({
    title: '', direction: '男频', genre: '玄幻升级', tags: [], premise: '',
    themePack: 'xuanhuan', audiencePack: 'male_upgrade', mechanicPacks: [], stylePacks: ['fast'],
    protagonistName: '', protagonistRole: '', protagonistGoal: '', protagonistFlaw: '',
    relationship: '宿命对手', conflict: '', chapterCount: 120, wordsPerChapter: 3000,
    lengthMode: 'auto', lengthModeSource: 'suggested',
    updateRhythm: '日更', ending: '成长型', pov: '第三人称', styleTags: ['爽文快节奏'], rules: '',
  })

  const layers = creativeOptions || fallbackLayers
  const themeOptions = useMemo(() => layers.themePacks?.options || fallbackLayers.themePacks.options, [layers])
  const audienceOptions = useMemo(() => layers.audiencePacks?.options || fallbackLayers.audiencePacks.options, [layers])
  const mechanicOptions = useMemo(() => layers.mechanicPacks?.options || fallbackLayers.mechanicPacks.options, [layers])
  const styleOptions = useMemo(() => layers.stylePacks?.options || fallbackLayers.stylePacks.options, [layers])
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const suggestedMode = suggestedLengthMode(form.chapterCount, form.wordsPerChapter)
  const effectiveLengthMode = form.lengthMode === 'auto' ? suggestedMode : form.lengthMode
  const toggle = (key, value) => setForm((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }))

  function finalizedSettings(settings) {
    const suggested = suggestedLengthMode(settings.chapterCount, settings.wordsPerChapter)
    return { ...settings, lengthMode: settings.lengthMode === 'auto' ? suggested : settings.lengthMode, lengthModeSource: settings.lengthMode === 'auto' ? 'suggested' : settings.lengthModeSource }
  }

  function selectTheme(option) {
    setForm((current) => ({ ...current, themePack: option.id, genre: option.label }))
  }

  function selectAudience(option) {
    const direction = option.id === 'female_emotion' || option.id === 'sweet' || option.id === 'intense' || option.id === 'dual_power' ? '女频' : '男频'
    setForm((current) => ({ ...current, audiencePack: option.id, direction }))
  }

  function toggleStyle(option) {
    setForm((current) => {
      const selected = current.stylePacks.includes(option.id)
      const stylePacks = selected ? current.stylePacks.filter((item) => item !== option.id) : [...current.stylePacks, option.id]
      const styleTags = selected ? current.styleTags.filter((item) => item !== option.label) : [...current.styleTags, option.label]
      return { ...current, stylePacks, styleTags }
    })
  }

  async function generate(feedback = '', settings = form) {
    setBusy(true)
    setError('')
    try {
      const result = await onGenerate(finalizedSettings(settings), feedback)
      if (!result?.blueprint?.options?.length) throw new Error('方案生成失败，请稍后重试')
      setBlueprint(result.blueprint)
      setMode(result.mode || 'demo')
    } catch (generationError) {
      setError(generationError.message || '方案生成失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  async function requestClarification() {
    setBusy(true)
    setError('')
    try {
      const result = await onClarify(finalizedSettings(form))
      if (!Array.isArray(result?.questions) || result.questions.length < 3) throw new Error('创作追问生成失败，请稍后重试')
      setClarifyingQuestions(result.questions)
      setClarificationAnswers(Object.fromEntries(result.questions.map((question) => [question.id, ''])))
    } catch (clarificationError) {
      setError(clarificationError.message || '创作追问生成失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  function generateWithClarifications() {
    const clarifications = clarifyingQuestions.map((question) => `${question.label}：${clarificationAnswers[question.id]?.trim() || '由创作总编根据整体设定判断'}`)
    generate('', { ...form, clarifications })
  }

  async function confirm(option) {
    setBusy(true)
    setError('')
    try {
      const created = await onCreate(finalizedSettings(form), option)
      if (created !== false) onClose()
    } catch (creationError) {
      setError(creationError.message || '作品创建失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  function next() {
    if (step < steps.length - 1) setStep((value) => value + 1)
    else requestClarification()
  }

  return (
    <div className="wizard-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <header className="wizard-head">
          <div><div className="wizard-title"><Sparkles size={17} />新建作品</div><p id="wizard-title">用几步把你的想法变成可以直接开始写的小说设定。</p></div>
          <button type="button" className="icon-button" title="关闭新建作品" disabled={busy} onClick={onClose}><X size={17} /></button>
        </header>
        {!blueprint && <div className="wizard-progress">{steps.map((item, index) => <div className={`wizard-progress-item ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`} key={item}><span>{index < step ? <Check size={12} /> : index + 1}</span>{item}</div>)}</div>}
        <div className="wizard-body">
          {blueprint ? <ProjectBlueprintPicker blueprint={blueprint} mode={mode} busy={busy} onRegenerate={generate} onConfirm={confirm} /> : clarifyingQuestions ? <div className="wizard-step clarification-step"><h2>再补三条决定质量的信息</h2><p>这些不是考试。选一个接近的方向或直接输入，作品总编会把它们纳入大纲和 Agent 规则。</p>{clarifyingQuestions.map((question) => <section className="wizard-section" key={question.id}><label>{question.label}</label>{question.options?.length > 0 && <div className="wizard-choice-grid">{question.options.map((option) => <Choice key={option} value={option} selected={clarificationAnswers[question.id] === option} onClick={() => setClarificationAnswers((current) => ({ ...current, [question.id]: option }))} />)}</div>}<input aria-label={question.label} value={clarificationAnswers[question.id] || ''} onChange={(event) => setClarificationAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder={question.placeholder || '补充你的想法'} /></section>)}</div> : <>
            {step === 0 && <div className="wizard-step"><h2>先组合你的题材配方</h2><p>主题材决定故事骨架，受众决定满足点，机制和写法决定每一章怎么推进。</p><div className="wizard-section"><label>主题材</label><div className="wizard-choice-grid">{themeOptions.map((option) => <Choice key={option.id} value={option.label} selected={form.themePack === option.id} onClick={() => selectTheme(option)} />)}</div></div><div className="wizard-section"><label>受众与情感</label><div className="wizard-choice-grid">{audienceOptions.map((option) => <Choice key={option.id} value={option.label} selected={form.audiencePack === option.id} onClick={() => selectAudience(option)} />)}</div></div><div className="wizard-section"><label>世界机制（可多选）</label><div className="wizard-choice-grid">{mechanicOptions.map((option) => <Choice key={option.id} value={option.label} selected={form.mechanicPacks.includes(option.id)} onClick={() => toggle('mechanicPacks', option.id)} />)}</div></div><label className="wizard-field">作品名（可先不填）<input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="例如：青灯问道" /></label></div>}
            {step === 1 && <div className="wizard-step"><h2>你想讲一个什么故事？</h2><p>先写大概想法，不需要完整大纲，AI 会帮你把它展开。</p><label className="wizard-field">故事灵感<textarea value={form.premise} onChange={(event) => update('premise', event.target.value)} placeholder="例如：一个被逐出宗门的少年，在旧城灯会发现师父当年失踪的真相……" /></label><div className="wizard-section"><label>内容标签（可多选）</label><div className="wizard-choice-grid">{['升级流', '复仇', '重生', '穿越', '系统', '无限流', '甜宠', '先婚后爱', '破镜重圆', '探案'].map((item) => <Choice key={item} value={item} selected={form.tags.includes(item)} onClick={() => toggle('tags', item)} />)}</div></div></div>}
            {step === 2 && <div className="wizard-step"><h2>主角是谁？</h2><p>人物越具体，后续生成的行为和对白越稳定。</p><div className="wizard-form-grid"><label className="wizard-field">主角姓名<input value={form.protagonistName} onChange={(event) => update('protagonistName', event.target.value)} placeholder="例如：顾长安" /></label><label className="wizard-field">身份/职业<input value={form.protagonistRole} onChange={(event) => update('protagonistRole', event.target.value)} placeholder="例如：被逐出的剑修" /></label></div><label className="wizard-field">主角目标<input value={form.protagonistGoal} onChange={(event) => update('protagonistGoal', event.target.value)} placeholder="例如：查清师父失踪的真相" /></label><label className="wizard-field">性格弱点（可选）<input value={form.protagonistFlaw} onChange={(event) => update('protagonistFlaw', event.target.value)} placeholder="例如：不愿相信任何人" /></label></div>}
            {step === 3 && <div className="wizard-step"><h2>冲突从哪里开始？</h2><p>这一部决定故事的推动力，选择后仍可补充自己的设定。</p><div className="wizard-section"><label>核心关系</label><div className="wizard-choice-grid">{['宿命对手', '欢喜冤家', '师徒羁绊', '契约关系', '家族对立', '团队伙伴'].map((item) => <Choice key={item} value={item} selected={form.relationship === item} onClick={() => update('relationship', item)} />)}</div></div><label className="wizard-field">核心冲突<textarea value={form.conflict} onChange={(event) => update('conflict', event.target.value)} placeholder="例如：主角必须在身份暴露前拿到玉佩，但唯一知道线索的人正是他的死敌。" /></label></div>}
            {step === 4 && <div className="wizard-step"><h2>你准备写多长？</h2><p>篇幅模式会改变后续大纲、场景卡、记忆和 Agent 的工作方式。</p><div className="wizard-section"><label>创作模式</label><div className="length-mode-grid">{lengthModes.map((item) => <button key={item.id} type="button" className={`length-mode ${effectiveLengthMode === item.id ? 'selected' : ''}`} onClick={() => setForm((current) => ({ ...current, lengthMode: item.id, lengthModeSource: 'manual' }))}><strong>{item.label}</strong><span>{item.hint}</span>{effectiveLengthMode === item.id && <Check size={15} />}</button>)}</div></div><div className="wizard-form-grid"><label className="wizard-field">计划章节数<input type="number" min="1" max="500" value={form.chapterCount} onChange={(event) => update('chapterCount', Number(event.target.value))} /></label><label className="wizard-field">每章字数<input type="number" min="500" max="10000" step="500" value={form.wordsPerChapter} onChange={(event) => update('wordsPerChapter', Number(event.target.value))} /></label></div><div className="length-suggestion">按当前约 {Math.max(0, Number(form.chapterCount || 0) * Number(form.wordsPerChapter || 0)).toLocaleString()} 字的计划，系统建议使用<strong>{lengthModes.find((item) => item.id === suggestedMode)?.label}</strong>模式。{form.lengthMode !== 'auto' && form.lengthMode !== suggestedMode && <button type="button" className="text-button" onClick={() => setForm((current) => ({ ...current, lengthMode: suggestedMode, lengthModeSource: 'suggested' }))}>采用建议</button>}</div><div className="wizard-section"><label>更新节奏</label><div className="wizard-choice-grid">{['日更', '每周 3-5 章', '周更', '随写随更'].map((item) => <Choice key={item} value={item} selected={form.updateRhythm === item} onClick={() => update('updateRhythm', item)} />)}</div></div><div className="wizard-section"><label>结局方向</label><div className="wizard-choice-grid">{['成长型', '圆满型', '开放式', '反转型'].map((item) => <Choice key={item} value={item} selected={form.ending === item} onClick={() => update('ending', item)} />)}</div></div></div>}
            {step === 5 && <div className="wizard-step"><h2>最后定制写作感觉</h2><p>这些偏好会作为全程写作规则，所有 GPT Agent 都会遵守。</p><div className="wizard-section"><label>叙事视角</label><div className="wizard-choice-grid">{['第一人称', '第三人称', '多视角切换'].map((item) => <Choice key={item} value={item} selected={form.pov === item} onClick={() => update('pov', item)} />)}</div></div><div className="wizard-section"><label>写法节奏（可多选）</label><div className="wizard-choice-grid">{styleOptions.map((option) => <Choice key={option.id} value={option.label} selected={form.stylePacks.includes(option.id)} onClick={() => toggleStyle(option)} />)}</div></div><label className="wizard-field">额外规则（可选）<textarea value={form.rules} onChange={(event) => update('rules', event.target.value)} placeholder="例如：不要降智，不要突然改变人物性格，感情线慢热。" /></label></div>}
          </>}
          {error && <p className="wizard-error" role="alert">{error}</p>}
        </div>
        <footer className="wizard-foot">
          {blueprint ? <><span>{busy ? '正在处理…' : '选定方案后才会创建作品'}</span><button type="button" className="button" disabled={busy} onClick={() => setBlueprint(null)}><ArrowLeft size={15} />返回修改设定</button></> : clarifyingQuestions ? <><span>AI 已根据题材组合补全关键追问</span><div><button type="button" className="button" disabled={busy} onClick={() => setClarifyingQuestions(null)}><ArrowLeft size={15} />返回修改</button><button type="button" className="button primary" disabled={busy} onClick={generateWithClarifications}><Sparkles size={15} />生成创作方案</button></div></> : <><span>第 {step + 1} / {steps.length} 步</span><div><button type="button" className="button" disabled={busy} onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}>{step === 0 ? '取消' : <><ArrowLeft size={15} />上一步</>}</button><button type="button" className="button primary" disabled={busy} onClick={next}>{step === steps.length - 1 ? <><Sparkles size={15} />继续深度定制</> : <>下一步<ArrowRight size={15} /></>}</button></div></>}
        </footer>
      </section>
    </div>
  )
}

export default NewProjectWizard
