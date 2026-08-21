import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Bot, FileCheck2, LoaderCircle, MessageCircleMore, PenLine, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2, WandSparkles, X } from 'lucide-react'
import { askAssistant, createChapter, deleteChapter, fetchAssistantHistory, fetchChapterTrash, fetchProject, previewAssistantActions, renameChapter, restoreChapter, runChapterAction, saveChapter } from './api.js'
import WritingToolsPanel from './WritingToolsPanel.jsx'

const seedMessages = [{ role: 'assistant', content: '我在这里陪你写。可以直接问我剧情、人物或文风；选中正文后，也可以让我就地改写。' }]

function chapterWords(chapter) { return String(chapter?.body || '').replace(/\s/g, '').length }

function WritingRoom({ project, onBack, onProjectRefresh }) {
  const chapters = Array.isArray(project?.chapters) ? project.chapters : []
  const [activeId, setActiveId] = useState(chapters[0]?.id || '')
  const activeChapter = chapters.find((chapter) => chapter.id === activeId) || chapters[0]
  const [draft, setDraft] = useState(activeChapter?.body || '')
  const [messages, setMessages] = useState(seedMessages)
  const [message, setMessage] = useState('')
  const [selection, setSelection] = useState(null)
  const [proposal, setProposal] = useState(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [chapterDialog, setChapterDialog] = useState(null)
  const [chapterTitle, setChapterTitle] = useState('')
  const [chapterGoal, setChapterGoal] = useState('')
  const [chapterError, setChapterError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [trashItems, setTrashItems] = useState([])
  const [trashError, setTrashError] = useState('')
  const editorRef = useRef(null)
  const chatEndRef = useRef(null)

  useEffect(() => { setDraft(activeChapter?.body || ''); setSelection(null); setProposal(null); setNotice('') }, [activeChapter?.body, activeChapter?.id])
  useEffect(() => {
    let cancelled = false
    if (!activeChapter?.id) { setMessages(seedMessages); return undefined }
    setMessages([])
    fetchAssistantHistory(activeChapter.id)
      .then((response) => { if (!cancelled) setMessages(response.messages?.length ? response.messages : seedMessages) })
      .catch(() => { if (!cancelled) setMessages(seedMessages) })
    return () => { cancelled = true }
  }, [activeChapter?.id])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages, busy])

  const wordCount = useMemo(() => draft.replace(/\s/g, '').length, [draft])
  const title = activeChapter?.title || '选择一个章节开始写作'
  function reportSelection() {
    const element = editorRef.current
    if (!element || element.selectionStart === element.selectionEnd) { setSelection(null); return }
    setSelection({ start: element.selectionStart, end: element.selectionEnd, text: draft.slice(element.selectionStart, element.selectionEnd) })
  }
  function updateActiveChapter(nextChapter) {
    onProjectRefresh({ ...project, chapters: chapters.map((chapter) => chapter.id === nextChapter.id ? nextChapter : chapter) })
  }
  async function refreshProject(nextActiveId = activeId) {
    const response = await fetchProject()
    const nextProject = response.project || project
    onProjectRefresh(nextProject)
    setActiveId(nextActiveId || nextProject.chapters?.[0]?.id || '')
  }
  function openChapterDialog(mode, chapter = null) {
    setChapterDialog({ mode, chapter })
    setChapterTitle(chapter?.title || `第 ${String(chapters.length + 1).padStart(2, '0')} 章`)
    setChapterGoal(chapter?.goal || '')
    setChapterError('')
    setDeleteConfirm(false)
  }
  function closeChapterDialog() {
    if (busy === 'chapter') return
    setChapterDialog(null)
    setChapterError('')
  }
  async function submitChapter(event) {
    event.preventDefault()
    setBusy('chapter'); setChapterError('')
    try {
      if (chapterDialog?.mode === 'rename') {
        await renameChapter(chapterDialog.chapter.id, chapterTitle.trim())
        await refreshProject(chapterDialog.chapter.id)
        setNotice('章节名称已更新。')
      } else {
        const response = await createChapter({ title: chapterTitle.trim(), goal: chapterGoal.trim() })
        await refreshProject(response.chapter?.id)
        setNotice('新章节已创建。')
      }
      setChapterDialog(null)
    } catch (error) { setChapterError(error.message || '章节保存失败，请重试') } finally { setBusy('') }
  }
  async function removeCurrentChapter() {
    if (!chapterDialog?.chapter || !deleteConfirm) { setDeleteConfirm(true); return }
    setBusy('chapter'); setChapterError('')
    try {
      const response = await deleteChapter(chapterDialog.chapter.id)
      await refreshProject(response.nextChapterId)
      setNotice('章节已移到回收记录，可在后续章节管理中恢复。')
      setChapterDialog(null)
    } catch (error) { setChapterError(error.message || '章节删除失败，请重试') } finally { setBusy('') }
  }
  async function openTrash() {
    setTrashOpen(true); setBusy('trash'); setTrashError('')
    try { const response = await fetchChapterTrash(); setTrashItems(response.chapters || []) } catch (error) { setTrashError(error.message || '无法读取章节回收站') } finally { setBusy('') }
  }
  async function restoreFromTrash(item) {
    setBusy(`restore:${item.trashId}`); setTrashError('')
    try { const response = await restoreChapter(item.trashId); await refreshProject(response.chapter?.id); setTrashItems((current) => current.filter((entry) => entry.trashId !== item.trashId)); setNotice(`已恢复「${response.chapter?.title || '章节'}」。`) } catch (error) { setTrashError(error.message || '章节恢复失败，请重试') } finally { setBusy('') }
  }
  async function save() {
    if (!activeChapter) return
    setBusy('save'); setNotice('')
    try { const response = await saveChapter({ ...activeChapter, body: draft }); updateActiveChapter(response.chapter); setNotice('已保存到本地作品。') } catch (error) { setNotice(error.message || '保存失败，请重试') } finally { setBusy('') }
  }
  async function chapterAction(operation) {
    if (!activeChapter) return
    setBusy(operation); setNotice('')
    try {
      const response = await runChapterAction(activeChapter.id, operation, selection ? { start: selection.start, end: selection.end } : undefined)
      if (response.replace) { setProposal({ type: 'text', title: operation === 'rewrite' ? 'AI 改写预览' : 'AI 精简预览', content: response.content, range: selection || { start: 0, end: draft.length } }); setSelection(null); setNotice('AI 已生成预览，确认后才会写入正文。') } else { setDraft(`${draft}${draft ? '\n\n' : ''}${response.content}`); setNotice(response.notice || 'AI 内容已插入正文，尚未保存。') }
    } catch (error) { setNotice(error.message || 'AI 操作暂时不可用') } finally { setBusy('') }
  }
  async function sendPrompt(prompt) {
    if (!prompt || !activeChapter) return
    const nextHistory = [...messages, { role: 'user', content: prompt }]
    setMessages(nextHistory); setMessage(''); setBusy('chat')
    try { const response = await askAssistant(prompt, messages, activeChapter.id); setMessages((current) => [...current, { role: 'assistant', content: response.reply, evidence: response.evidence || [], instruction: prompt }]) } catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error.message || '这次没有收到回复，请稍后重试。', error: true }]) } finally { setBusy('') }
  }
  function sendMessage(event) { event.preventDefault(); sendPrompt(message.trim()) }
  async function createAssistantProposal(item) {
    if (!activeChapter || item.error) return
    setBusy('preview'); setNotice('')
    try { const response = await previewAssistantActions(activeChapter.id, item.instruction || '将以上建议应用到当前正文', item.content, draft); setProposal({ type: 'actions', title: response.summary || 'AI 修改提案', actions: response.actions || [] }); setNotice(response.actions?.length ? '已生成修改预览，确认后才会写入正文。' : '这条建议没有可直接应用的正文修改。') } catch (error) { setNotice(error.message || '无法生成修改预览') } finally { setBusy('') }
  }
  function applyProposal() {
    if (!proposal) return
    if (proposal.type === 'text') { setDraft(`${draft.slice(0, proposal.range.start)}${proposal.content}${draft.slice(proposal.range.end)}`) } else {
      const draftActions = proposal.actions.filter((action) => action.target === 'draft_append' || action.target === 'draft_replace')
      setDraft(draftActions.reduce((current, action) => action.target === 'draft_append' ? `${current}${current ? '\n\n' : ''}${action.after}` : action.after, draft))
    }
    setProposal(null); setNotice('修改已写入编辑器，点击保存后才会同步到作品。')
  }
  function applyToolResult(response) {
    if (!response?.chapter) return
    setDraft(response.chapter.body || '')
    onProjectRefresh({ ...project, chapters: chapters.map((chapter) => chapter.id === response.chapter.id ? response.chapter : chapter), memory: response.memory || project.memory })
    setNotice('协作结果已应用到当前章节和长期记忆。')
  }
  const actionLabel = selection ? `已选 ${selection.text.length} 字` : '选中一段文字后可精确改写'

  return <div className="nf-writing-room">
    <header className="nf-writing-top"><button type="button" onClick={onBack} title="返回作品资料"><ArrowLeft size={17} /></button><div><span>{project?.title || '未命名作品'} / 正文写作</span><strong>{title}</strong></div><div className="nf-writing-top-actions"><span>{busy === 'save' ? '保存中…' : notice || '本地自动保存已启用'}</span><button type="button" className="nf-secondary-button" onClick={() => setToolsOpen(true)}><Sparkles size={14} />创作工具</button><button type="button" className="nf-secondary-button" onClick={save} disabled={Boolean(busy)}><Save size={14} />保存</button></div></header>
    <div className="nf-writing-grid">
      <aside className="nf-chapter-rail"><div className="nf-rail-heading"><span>章节 <small>{chapters.length}</small></span><div><button type="button" title="新建章节" onClick={() => openChapterDialog('create')}><Plus size={15} /></button><button type="button" title="章节回收站" onClick={openTrash}><Trash2 size={14} /></button><button type="button" title="刷新章节" onClick={() => refreshProject()}><Sparkles size={14} /></button></div></div>{chapters.map((chapter) => <div className={`nf-chapter-row-wrap ${chapter.id === activeChapter?.id ? 'is-active' : ''}`} key={chapter.id}><button type="button" className="nf-chapter-row" onClick={() => setActiveId(chapter.id)}><span>第 {chapter.id} 章</span><strong>{chapter.title || '待命名章节'}</strong><small>{chapter.status || '待写'} · {chapterWords(chapter)} 字</small></button><button type="button" className="nf-chapter-menu-button" title={`编辑第 ${chapter.id} 章`} onClick={() => openChapterDialog('rename', chapter)}><Pencil size={13} /></button></div>)}</aside>
      <main className="nf-editor-pane"><div className="nf-editor-meta"><span>{activeChapter?.status || '草稿'}</span><span>目标：{activeChapter?.goal || '推进主线，并在结尾留下新的钩子。'}</span></div><input className="nf-chapter-title" value={title} readOnly aria-label="章节标题" /><textarea ref={editorRef} className="nf-editor" value={draft} onChange={(event) => setDraft(event.target.value)} onSelect={reportSelection} onKeyUp={reportSelection} onMouseUp={reportSelection} placeholder="从这里开始写下这一章…" /><footer className="nf-editor-footer"><span>{wordCount.toLocaleString('zh-CN')} 字</span><span>第 {activeChapter?.id || '—'} 章</span><button type="button" onClick={() => chapterAction('continue')} disabled={Boolean(busy)}><WandSparkles size={14} />续写</button></footer>{selection && <div className="nf-selection-actions"><span>{actionLabel}</span><button type="button" onClick={() => chapterAction('rewrite')} disabled={Boolean(busy)}><PenLine size={14} />改写</button><button type="button" onClick={() => chapterAction('condense')} disabled={Boolean(busy)}>精简</button><button type="button" onClick={() => { sendPrompt(`请分析并优化这段文字：${selection.text}`); setSelection(null) }}><MessageCircleMore size={14} />问阿流</button></div>}</main>
      <aside className="nf-ai-panel"><header><div className="nf-ai-avatar"><Bot size={18} /></div><div><strong>阿流</strong><span>正在读取当前作品与章节上下文</span></div></header><div className="nf-ai-tools"><button type="button" onClick={() => sendPrompt('请给我三个能推动当前章节的转折方向。')}><Sparkles size={14} />给我下一步</button><button type="button" onClick={() => sendPrompt('请检查当前章节的人物动机和伏笔是否一致。')}><FileCheck2 size={14} />检查一致性</button></div>{proposal && <section className="nf-ai-proposal"><strong>{proposal.title}</strong>{proposal.type === 'text' ? <p>{proposal.content}</p> : proposal.actions.length ? proposal.actions.map((action) => <article key={`${action.target}-${action.label}`}><span>{action.label}</span><p>{action.reason}</p><small>{action.after}</small></article>) : <p>没有可自动应用的正文修改。</p>}<div><button type="button" onClick={() => setProposal(null)}>放弃</button><button type="button" className="nf-primary-button" onClick={applyProposal}>确认应用</button></div></section>}<div className="nf-chat-list">{messages.map((item, index) => <article className={`nf-chat-message ${item.role}`} key={`${item.role}-${index}`}><span>{item.role === 'assistant' ? '阿' : '我'}</span><div><p>{item.content}</p>{item.evidence?.length > 0 && <small>参考：{item.evidence.map((evidence) => evidence.title).join('、')}</small>}{item.role === 'assistant' && item.instruction && <button type="button" onClick={() => createAssistantProposal(item)} disabled={Boolean(busy)}>生成修改预览</button>}</div></article>)}{busy === 'chat' || busy === 'preview' ? <article className="nf-chat-message assistant"><span>阿</span><div className="nf-chat-loading"><LoaderCircle size={15} />阿流正在思考…</div></article> : null}<div ref={chatEndRef} /></div><form className="nf-chat-input" onSubmit={sendMessage}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="问阿流关于这一章的任何问题…" rows="3" /><button type="submit" title="发送给阿流" disabled={busy === 'chat' || !message.trim()}><ArrowUp size={17} /></button></form></aside>
    </div>{toolsOpen && <WritingToolsPanel project={project} chapter={activeChapter} onClose={() => setToolsOpen(false)} onApplyResult={applyToolResult} />}{chapterDialog && <div className="nf-chapter-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeChapterDialog()}><form className="nf-chapter-dialog" role="dialog" aria-modal="true" onSubmit={submitChapter}><header><div><span>{chapterDialog.mode === 'rename' ? '章节设置' : '新建章节'}</span><h2>{chapterDialog.mode === 'rename' ? `编辑第 ${chapterDialog.chapter.id} 章` : '添加下一章'}</h2></div><button type="button" title="关闭" onClick={closeChapterDialog}><X size={17} /></button></header><label>章节名称<input autoFocus value={chapterTitle} onChange={(event) => setChapterTitle(event.target.value)} maxLength="100" required /></label>{chapterDialog.mode === 'create' && <label>章节目标<textarea value={chapterGoal} onChange={(event) => setChapterGoal(event.target.value)} maxLength="1500" placeholder="这一章要推进什么？" /></label>}{chapterError && <p className="nf-chapter-dialog-error">{chapterError}</p>}<footer>{chapterDialog.mode === 'rename' && <button type="button" className="nf-danger-action" onClick={removeCurrentChapter} disabled={busy === 'chapter'}><Trash2 size={14} />{deleteConfirm ? '再次点击确认删除' : '删除章节'}</button>}<span /><button type="button" className="nf-secondary-button" onClick={closeChapterDialog}>取消</button><button type="submit" className="nf-primary-button" disabled={busy === 'chapter' || !chapterTitle.trim()}>{busy === 'chapter' ? <><LoaderCircle size={14} />保存中…</> : '保存章节'}</button></footer></form></div>}{trashOpen && <div className="nf-chapter-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTrashOpen(false)}><section className="nf-chapter-dialog nf-chapter-trash" role="dialog" aria-modal="true" aria-labelledby="chapter-trash-title"><header><div><span>章节回收站</span><h2 id="chapter-trash-title">恢复误删章节</h2></div><button type="button" title="关闭" onClick={() => setTrashOpen(false)}><X size={17} /></button></header><p>恢复后系统会自动插回原位置、重新编号，并同步该章正文和记忆。</p><div className="nf-chapter-trash-list">{trashItems.length ? trashItems.map((item) => <article key={item.trashId}><div><strong>{item.chapter?.title || '未命名章节'}</strong><span>删除于 {item.deletedAt ? new Date(item.deletedAt).toLocaleString('zh-CN') : '未知时间'}</span></div><button type="button" onClick={() => restoreFromTrash(item)} disabled={busy !== ''}>{busy === `restore:${item.trashId}` ? <LoaderCircle size={14} /> : <><RotateCcw size={14} />恢复</>}</button></article>) : <p>{busy === 'trash' ? '正在读取回收站…' : '回收站为空。'}</p>}</div>{trashError && <p className="nf-chapter-dialog-error">{trashError}</p>}</section></div>}
  </div>
}

export default WritingRoom
