import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, FileCheck2, GitBranch, History, LoaderCircle, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { applyWorkflow, checkConsistency, fetchWorkflowTasks, runWorkflow, searchMemory } from './api.js'
import './WritingTools.css'

const agentOptions = [
  ['architect', '总编'], ['arc', '剧情弧'], ['plot', '情节'], ['character', '人物'], ['foreshadow', '伏笔'], ['world', '世界观'],
]
const focusOptions = [['all', '全面'], ['character', '人物'], ['foreshadow', '伏笔']]

function scoreTone(score) { return score >= 80 ? 'is-good' : score >= 60 ? 'is-warn' : 'is-risk' }

function MemoryList({ title, items = [] }) {
  const values = Array.isArray(items) ? items.filter(Boolean).slice(0, 8) : []
  return <section className="nf-tool-memory-block"><h4>{title}</h4>{values.length ? <ul>{values.map((item, index) => <li key={`${title}-${index}`}>{typeof item === 'string' ? item : item.name || item.text || item.summary || JSON.stringify(item)}</li>)}</ul> : <p>暂无记录</p>}</section>
}

function WritingToolsPanel({ project, chapter, onClose, onApplyResult }) {
  const [tab, setTab] = useState('review')
  const [focus, setFocus] = useState('all')
  const [report, setReport] = useState(null)
  const [selectedAgents, setSelectedAgents] = useState(['architect', 'arc', 'plot', 'character', 'foreshadow'])
  const [workflow, setWorkflow] = useState(null)
  const [tasks, setTasks] = useState([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const memory = project?.memory || {}
  const selectedCount = selectedAgents.length
  const workflowSteps = workflow?.steps || []
  const workflowDraft = workflow?.generatedDraft || ''
  const qualityGate = workflow?.qualityGate || null
  const score = report?.score ?? 0

  useEffect(() => {
    if (tab !== 'workflow') return undefined
    let cancelled = false
    fetchWorkflowTasks().then((payload) => { if (!cancelled) setTasks(payload.tasks || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [tab, workflow])

  async function review() {
    setBusy('review'); setError('')
    try { const response = await checkConsistency(chapter.id, focus); setReport(response.report) } catch (requestError) { setError(requestError.message || '一致性检查失败') } finally { setBusy('') }
  }
  async function runCollaboration() {
    setBusy('workflow'); setError(''); setWorkflow(null)
    try { setWorkflow(await runWorkflow(chapter.id, selectedAgents)) } catch (requestError) { setError(requestError.message || '协作任务运行失败') } finally { setBusy('') }
  }
  async function applyCollaboration() {
    if (!workflow?.runId) return
    setBusy('apply'); setError('')
    try { const response = await applyWorkflow(workflow.runId, workflow.agentIds || selectedAgents); onApplyResult(response); setWorkflow(null) } catch (requestError) { setError(requestError.message || '协作结果应用失败') } finally { setBusy('') }
  }
  async function search() {
    if (!query.trim()) return
    setBusy('memory'); setError('')
    try { const response = await searchMemory(query.trim()); setResults(response.results || []) } catch (requestError) { setError(requestError.message || '记忆检索失败') } finally { setBusy('') }
  }
  function toggleAgent(id) { setSelectedAgents((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }

  return <div className="nf-tools-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="nf-tools-drawer" role="dialog" aria-modal="true" aria-labelledby="nf-tools-title"><header className="nf-tools-head"><div><span><Sparkles size={15} />创作工具</span><h2 id="nf-tools-title">让阿流帮你把这一章写稳</h2><p>所有结果都会先展示，确认后才会改变正文或长期记忆。</p></div><button type="button" title="关闭创作工具" onClick={onClose}><X size={18} /></button></header><nav className="nf-tools-tabs" role="tablist"><button type="button" className={tab === 'review' ? 'is-active' : ''} onClick={() => setTab('review')}><ShieldCheck size={15} />一致性审校</button><button type="button" className={tab === 'workflow' ? 'is-active' : ''} onClick={() => setTab('workflow')}><Bot size={15} />多 Agent 协作</button><button type="button" className={tab === 'memory' ? 'is-active' : ''} onClick={() => setTab('memory')}><History size={15} />长期记忆</button></nav><div className="nf-tools-body">{tab === 'review' && <section className="nf-tool-view"><div className="nf-tool-intro"><FileCheck2 size={22} /><div><h3>检查当前章节</h3><p>阿流会对人物动机、伏笔、世界规则和章节节奏给出可执行意见。</p></div></div><div className="nf-segmented">{focusOptions.map(([id, label]) => <button type="button" className={focus === id ? 'is-active' : ''} key={id} onClick={() => setFocus(id)}>{label}</button>)}</div><button type="button" className="nf-primary-button nf-tool-run" disabled={Boolean(busy)} onClick={review}>{busy === 'review' ? <><LoaderCircle size={14} />检查中…</> : <><ShieldCheck size={14} />开始检查</>}</button>{report && <div className="nf-review-result"><div className="nf-review-score"><div><span>本章质量评分</span><strong className={scoreTone(score)}>{score}</strong></div><small>{report.focus === 'all' ? '全面检查' : report.focus === 'character' ? '人物检查' : '伏笔检查'}</small></div><div className="nf-review-metrics">{(report.metrics || []).map((metric) => <div key={metric.id}><span>{metric.id}</span><b className={scoreTone(metric.score)}>{metric.score}</b><i><em style={{ width: `${metric.score}%` }} /></i></div>)}</div><ReviewList title="人物问题" items={report.characterIssues} /><ReviewList title="伏笔与规则风险" items={[...(report.foreshadowRisks || []), ...(report.worldRuleRisks || [])]} /><ReviewList title="建议下一步" items={report.fixes} /></div>}</section>}{tab === 'workflow' && <section className="nf-tool-view"><div className="nf-tool-intro"><GitBranch size={22} /><div><h3>多 Agent 协作</h3><p>总编、剧情、人物、写手、审校和记忆整理员会按顺序交接工作。</p></div></div><div className="nf-agent-picker"><label>你希望额外参与的 Agent</label><div>{agentOptions.map(([id, label]) => <button type="button" className={selectedAgents.includes(id) ? 'is-selected' : ''} key={id} onClick={() => toggleAgent(id)}>{label}{selectedAgents.includes(id) && <CheckCircle2 size={13} />}</button>)}</div><small>写手、审校、修订和记忆整理员会自动加入，保证流程完整。</small></div><button type="button" className="nf-primary-button nf-tool-run" disabled={Boolean(busy) || selectedCount === 0} onClick={runCollaboration}>{busy === 'workflow' ? <><LoaderCircle size={14} />协作中…</> : <><Bot size={14} />运行协作（{selectedCount + 4} 个 Agent）</>}</button>{workflow && <div className="nf-workflow-result"><div className="nf-workflow-status"><span>协作完成，候选正文尚未应用</span><b className={qualityGate?.status === 'passed' ? 'is-good' : 'is-warn'}>{qualityGate?.score || 0} 分</b></div><div className="nf-workflow-steps">{workflowSteps.map((step) => <article key={step.id}><span>{step.label}</span><p>{step.result?.summary || step.content}</p>{step.result?.risks?.length > 0 && <small>风险：{step.result.risks.join('；')}</small>}</article>)}</div>{workflowDraft && <details><summary>查看候选正文</summary><p>{workflowDraft}</p></details>}<button type="button" className="nf-primary-button nf-tool-run" disabled={Boolean(busy)} onClick={applyCollaboration}>{busy === 'apply' ? <><LoaderCircle size={14} />应用中…</> : <>确认应用协作结果</>}</button></div>}{tasks.length > 0 && <div className="nf-task-history"><h4>最近协作任务</h4>{tasks.slice(0, 4).map((task) => <div key={task.id}><span>{task.status === 'applied' ? '已应用' : task.status === 'awaiting_review' ? '待确认' : task.status}</span><small>{task.updatedAt ? new Date(task.updatedAt).toLocaleString('zh-CN') : '刚刚'}</small></div>)}</div>}</section>}{tab === 'memory' && <section className="nf-tool-view"><div className="nf-tool-intro"><History size={22} /><div><h3>长期记忆</h3><p>写作房间会一直参考这些人物状态、伏笔和章节事实。</p></div></div><form className="nf-memory-search" onSubmit={(event) => { event.preventDefault(); search() }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人物、地点、伏笔或章节事实" /><button type="submit" title="搜索记忆" disabled={busy === 'memory' || !query.trim()}>{busy === 'memory' ? <LoaderCircle size={15} /> : <Search size={15} />}</button></form>{results.length > 0 && <section className="nf-memory-results"><h4>检索结果</h4>{results.map((result, index) => <article key={`${result.title}-${index}`}><strong>{result.title || '相关记忆'}</strong><p>{result.content}</p></article>)}</section>}<div className="nf-memory-grid"><MemoryList title="人物状态" items={memory.characters} /><MemoryList title="进行中伏笔" items={memory.foreshadows} /><MemoryList title="章节摘要" items={Object.entries(memory.chapter_summaries || {}).map(([id, value]) => `第 ${id} 章：${value}`)} /><MemoryList title="近期决策" items={(memory.decisions || []).slice(-6).reverse().map((item) => item.review || item.source || '已记录一次创作决策')} /></div></section>}</div>{error && <p className="nf-tools-error" role="alert">{error}</p>}</aside></div>
}

function ReviewList({ title, items = [] }) { return <section className="nf-review-list"><h4>{title}</h4>{items.length ? <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul> : <p>未发现明显问题</p>}</section> }

export default WritingToolsPanel
