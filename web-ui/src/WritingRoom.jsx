import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Bot, Download, FileCheck2, LoaderCircle, MessageCircleMore, PenLine, Pencil, Plus, RotateCcw, Save, Sparkles, Square, Trash2, WandSparkles, X } from 'lucide-react'
import { askAssistant, createChapter, deleteChapter, exportProjectFile, exportProjectJson, fetchAssistantHistory, fetchChapterTrash, fetchProject, previewAssistantActions, refreshStoryDossier, renameChapter, restoreChapter, runChapterAction, saveChapter } from './api.js'
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
  const [exportOpen, setExportOpen] = useState(false)
  const [exportError, setExportError] = useState('')
  const editorRef = useRef(null)
  const chatEndRef = useRef(null)
  const activeRequestRef = useRef(null)
  // Async saves can finish after another state update. Keep a canonical
  // snapshot so a late dossier/title response cannot restore stale chapters.
  const projectRef = useRef(project)
  projectRef.current = project

  useEffect(() => {
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setBusy('')
    setDraft(activeChapter?.body || '')
    setSelection(null)
    setProposal(null)
    setNotice('')
    if (editorRef.current) editorRef.current.scrollTop = 0
  }, [activeChapter?.body, activeChapter?.id])
  useEffect(() => {
    let cancelled = false
    if (!activeChapter?.id) { setMessages(seedMessages); return undefined }
    setMessages([])
    fetchAssistantHistory(activeChapter.id)
      .then((response) => { if (!cancelled) setMessages(response.messages?.length ? response.messages : seedMessages) })
      .catch(() => { if (!cancelled) setMessages(seedMessages) })
    return () => { cancelled = true }
  }, [activeChapter?.id])
  useEffect(() => {
    const chatList = chatEndRef.current?.parentElement
    if (chatList) chatList.scrollTop = chatList.scrollHeight
  }, [messages, busy])

  const wordCount = useMemo(() => draft.replace(/\s/g, '').length, [draft])
  const title = activeChapter?.title || '选择一个章节开始写作'
  function reportSelection() {
    const element = editorRef.current
    if (!element || element.selectionStart === element.selectionEnd) { setSelection(null); return }
    setSelection({ start: element.selectionStart, end: element.selectionEnd, text: draft.slice(element.selectionStart, element.selectionEnd) })
  }
  function updateActiveChapter(nextChapter) {
    const currentProject = projectRef.current || project
    const currentChapters = Array.isArray(currentProject?.chapters) ? currentProject.chapters : []
    const definedFields = Object.fromEntries(Object.entries(nextChapter).filter(([, value]) => value !== undefined))
    const nextProject = { ...currentProject, chapters: currentChapters.map((chapter) => chapter.id === nextChapter.id ? { ...chapter, ...definedFields } : chapter) }
    projectRef.current = nextProject
    onProjectRefresh(nextProject)
  }
  async function persistDraft(chapter, body) {
    const response = await saveChapter({ ...chapter, body })
    const currentProject = projectRef.current || project
    const currentChapters = Array.isArray(currentProject?.chapters) ? currentProject.chapters : []
    const nextProject = {
      ...currentProject,
      chapters: currentChapters.map((item) => item.id === response.chapter.id ? { ...item, ...response.chapter } : item),
      memory: response.memory || currentProject.memory,
    }
    projectRef.current = nextProject
    onProjectRefresh(nextProject)
    return response
  }
  async function selectChapter(nextId) {
    if (!nextId || nextId === activeChapter?.id) return
    if (busy) {
      setNotice('当前 AI 操作还在进行，请等待完成或点击“停止”后再切换章节。')
      return
    }
    const savedBody = String(activeChapter?.body || '')
    if (activeChapter && draft !== savedBody) {
      setBusy('save')
      try {
        await persistDraft(activeChapter, draft)
      } catch (error) {
        setNotice(`当前章节尚未保存，暂时不能切换：${error.message || '保存失败，请重试'}`)
        return
      } finally {
        setBusy('')
      }
    }
    // Re-read after the save so returning to a chapter always uses the
    // server's authoritative body, including AI-generated text.
    await refreshProject(nextId)
  }
  async function refreshProject(nextActiveId = activeId) {
    const response = await fetchProject()
    const nextProject = response.project || projectRef.current || project
    projectRef.current = nextProject
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
    try {
      const response = await saveChapter({ ...activeChapter, body: draft })
      const currentProject = projectRef.current || project
      const currentChapters = Array.isArray(currentProject?.chapters) ? currentProject.chapters : []
      const nextProject = { ...currentProject, chapters: currentChapters.map((chapter) => chapter.id === response.chapter.id ? { ...chapter, ...response.chapter } : chapter), memory: response.memory || currentProject.memory }
      projectRef.current = nextProject
      onProjectRefresh(nextProject)
      setNotice('正文已保存，资料同步中…')
      refreshStoryDossier(response.chapter.id)
        .then((dossierResponse) => {
          const latestProject = projectRef.current || nextProject
          const dossierProject = { ...latestProject, memory: dossierResponse.memory || { ...latestProject.memory, story_dossier: dossierResponse.dossier } }
          projectRef.current = dossierProject
          onProjectRefresh(dossierProject)
          setNotice(`正文已保存，资料已同步至第 ${dossierResponse.dossier?.updatedThroughChapter || response.chapter.id} 章。`)
        })
        .catch((syncError) => { setNotice(`正文已保存；资料暂未同步：${syncError.message || '请稍后从作品资料页重试'}`) })
    } catch (error) { setNotice(error.message || '保存失败，请重试') } finally { setBusy('') }
  }
  function downloadBytes(data, fileName, contentType) {
    const binary = atob(data)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([bytes], { type: contentType }))
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(link.href)
  }
  async function exportWork(format) {
    if (!project?.id) return
    if (activeChapter && draft !== String(activeChapter.body || '')) {
      setExportError('当前章节有未保存修改，请先点击“保存”，再导出完整作品。')
      return
    }
    setBusy(`export:${format}`); setExportError('')
    try {
      if (format === 'json') {
        const response = await exportProjectJson(project.id)
        const title = String(response.project?.title || project.title || 'NovelFlow作品').replace(/[\\/:*?"<>|]/g, '_')
        const file = new Blob([JSON.stringify(response.project, null, 2)], { type: 'application/json;charset=utf-8' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(file); link.download = `${title}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href)
      } else {
        const response = await exportProjectFile(project.id, format)
        downloadBytes(response.data, response.fileName, response.contentType)
      }
      setNotice(`已导出 ${format === 'docx' ? 'Word' : format === 'epub' ? 'EPUB' : 'JSON'} 文件。`)
      setExportOpen(false)
    } catch (error) { setExportError(error.message || '导出失败，请稍后重试') } finally { setBusy('') }
  }
  async function chapterAction(operation, instruction = '') {
    if (!activeChapter || busy) return null
    const controller = new AbortController()
    activeRequestRef.current = controller
    setBusy(operation); setNotice('')
    try {
      const response = await runChapterAction(activeChapter.id, operation, selection ? { start: selection.start, end: selection.end } : undefined, controller.signal, instruction)
      if (operation === 'continue') {
        const generatedWords = Number(response.generatedWords ?? String(response.content || '').replace(/\s/g, '').length)
        const targetWords = Number(response.targetWords || project?.settings?.wordsPerChapter || 2000)
        const minimumWords = Math.max(500, Math.min(targetWords, Math.floor(targetWords * 0.6)))
        if (generatedWords < minimumWords) {
          const shortResultNotice = `本次模型只返回 ${generatedWords.toLocaleString('zh-CN')} 字，低于本章最低要求 ${minimumWords.toLocaleString('zh-CN')} 字，未放入编辑器。请重试，或明确要求“完整生成本章正文”。`
          setNotice(shortResultNotice)
          setMessages((current) => [...current, { role: 'assistant', content: shortResultNotice, error: true, status: true }])
          return null
        }
      }
      if (response.replace) {
        setProposal({ type: 'text', title: operation === 'rewrite' ? 'AI 改写预览' : 'AI 精简预览', content: response.content, range: selection || { start: 0, end: draft.length } })
        setSelection(null)
        setNotice('AI 已生成预览，确认后才会写入正文。')
      } else {
        const nextDraft = `${draft}${draft ? '\n\n' : ''}${response.content}`
        setDraft(nextDraft)
        const titleUpdated = await syncChapterTitleFromText(response.content)
        try {
          await persistDraft({ ...activeChapter, title: titleUpdated || activeChapter.title }, nextDraft)
          setNotice(response.notice || (titleUpdated ? 'AI 正文已写入第当前章节，并自动保存。' : 'AI 正文已写入当前章节，并自动保存。'))
          setMessages((current) => [...current, { role: 'assistant', content: `已完成本章正文，共生成 ${Number(response.generatedWords || 0).toLocaleString('zh-CN')} 字，已自动保存。`, status: true, action: 'show-editor' }])
        } catch (error) {
          setNotice(`正文已生成到编辑器草稿，但自动保存失败：${error.message || '请点击保存后再切换章节'}`)
          setMessages((current) => [...current, { role: 'assistant', content: '正文已生成到编辑器草稿，但还没有保存到作品。请先点击顶部“保存”，再切换章节。', error: true, status: true, action: 'show-editor' }])
        }
      }
      return response
    } catch (error) {
      if (error?.name !== 'AbortError') {
        const message = error.message || 'AI 操作暂时不可用'
        setNotice(message)
        setMessages((current) => [...current, { role: 'assistant', content: message, error: true, status: true }])
      }
      return null
    } finally { if (activeRequestRef.current === controller) activeRequestRef.current = null; setBusy('') }
  }
  function chapterTitleFromText(content) {
    const heading = String(content || '').split(/\r?\n/).map((line) => line.trim()).find((line) => /^#{1,6}\s+/.test(line))
    if (!heading) return ''
    const title = heading.replace(/^#{1,6}\s+/, '').replace(/^第\s*[一二三四五六七八九十百千万\d]+\s*章\s*[·．、:：\-—]?\s*/, '').trim()
    return title.length > 0 && title.length <= 100 ? title : ''
  }
  function proseWithoutChapterTitle(content) {
    return String(content || '').replace(/^\s*#{1,6}\s+[^\r\n]*(?:\r?\n\s*){1,2}/, '').trim()
  }
  async function syncChapterTitleFromText(content) {
    const nextTitle = chapterTitleFromText(content)
    if (!nextTitle || !activeChapter || nextTitle === activeChapter.title) return ''
    try {
      const response = await renameChapter(activeChapter.id, nextTitle)
      // Rename responses contain the old body. Merge only the title into the
      // latest local chapter so title sync can never erase generated prose.
      updateActiveChapter({ ...response.chapter, body: undefined })
      return nextTitle
    } catch (error) {
      setNotice(`正文已写入编辑器草稿，但章节名称未同步：${error.message || '请稍后重试'}`)
      return ''
    }
  }
  async function insertAssistantText(item) {
    if (!item || item.role !== 'assistant' || item.error || item.status || !String(item.content || '').trim()) return
    const prose = proseWithoutChapterTitle(item.content)
    if (!prose) { setNotice('这条回复只有章节标题，没有可写入的正文。'); return }
    const nextDraft = `${draft}${draft ? '\n\n' : ''}${prose}`
    setDraft(nextDraft)
    setBusy('save')
    try {
      const titleUpdated = await syncChapterTitleFromText(item.content)
      await persistDraft({ ...activeChapter, title: titleUpdated || activeChapter.title }, nextDraft)
      setNotice(titleUpdated ? '已写入正文并同步章节名称，内容已自动保存。' : '已写入正文，内容已自动保存。')
    } catch (error) {
      setNotice(`已写入编辑器草稿，但自动保存失败：${error.message || '请点击保存后再切换章节'}`)
    } finally {
      setBusy('')
    }
  }
  function isDraftInsertPrompt(prompt) {
    return /写入正文|加入正文|放进正文|插入正文/.test(prompt) && !/不要|无需|不用|不能/.test(prompt)
  }
  function isChapterRewritePrompt(prompt) {
    return /(重写|重新生成|改写).*(本章|当前章节|第?\s*[一二三四五六七八九十百千万\d]+\s*章)/.test(prompt)
  }
  async function sendPrompt(prompt) {
    if (!prompt || !activeChapter) return
    const nextHistory = [...messages, { role: 'user', content: prompt }]
    if (isDraftInsertPrompt(prompt)) {
      const previousAssistant = [...messages].reverse().find((item) => item.role === 'assistant' && !item.error && !item.status && String(item.content || '').trim())
      setMessages(nextHistory)
      setMessage('')
      if (previousAssistant) {
        await insertAssistantText(previousAssistant)
        setMessages((current) => [...current, { role: 'assistant', content: '已将上一条回复放入编辑器草稿。请检查内容，确认无误后点击顶部“保存”。' }])
      } else {
        setMessages((current) => [...current, { role: 'assistant', content: '当前还没有可写入的阿流回复，请先让我生成一段正文。', error: true }])
        setNotice('还没有可写入的阿流回复。')
      }
      return
    }
    if (isChapterRewritePrompt(prompt)) {
      setMessages(nextHistory); setMessage('')
      const response = await chapterAction('rewrite', prompt)
      if (response) setMessages((current) => [...current, { role: 'assistant', content: '已生成整章重写预览，请在上方检查内容并点击“确认应用”；确认后还要点击顶部“保存”。', status: true }])
      return
    }
    if (/(完整正文|写第?\s*[一二三四五六七八九十百千万\d]+\s*章|生成第?\s*[一二三四五六七八九十百千万\d]+\s*章|写本章|生成本章|续写本章|直接写|开始写)/i.test(prompt)) {
      setMessages(nextHistory); setMessage('')
      await chapterAction('continue', prompt)
      return
    }
    const controller = new AbortController()
    activeRequestRef.current = controller
    setMessages(nextHistory); setMessage(''); setBusy('chat')
    try { const response = await askAssistant(prompt, messages, activeChapter.id, controller.signal); setMessages((current) => [...current, { role: 'assistant', content: response.reply, evidence: response.evidence || [], instruction: prompt }]) } catch (error) { if (error?.name !== 'AbortError') setMessages((current) => [...current, { role: 'assistant', content: error.message || '这次没有收到回复，请稍后重试。', error: true }]) } finally { if (activeRequestRef.current === controller) activeRequestRef.current = null; setBusy('') }
  }
  function stopActiveRequest() {
    activeRequestRef.current?.abort()
    activeRequestRef.current = null
    setBusy('')
    setNotice('已停止等待，本次结果不会自动写入正文。')
  }
  function showEditor() {
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    editorRef.current?.focus({ preventScroll: true })
  }
  function sendMessage(event) { event.preventDefault(); if (!busy) sendPrompt(message.trim()) }
  function handleMessageKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!busy && message.trim()) sendPrompt(message.trim())
  }
  async function createAssistantProposal(item) {
    if (!activeChapter || item.error) return
    const controller = new AbortController()
    activeRequestRef.current = controller
    setBusy('preview'); setNotice('')
    try { const response = await previewAssistantActions(activeChapter.id, item.instruction || '将以上建议应用到当前正文', item.content, draft, controller.signal); setProposal({ type: 'actions', title: response.summary || 'AI 修改提案', actions: response.actions || [] }); setNotice(response.actions?.length ? '已生成修改预览，确认后才会写入正文。' : '这条建议没有可直接应用的正文修改。') } catch (error) { if (error?.name !== 'AbortError') setNotice(error.message || '无法生成修改预览') } finally { if (activeRequestRef.current === controller) activeRequestRef.current = null; setBusy('') }
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
    <header className="nf-writing-top"><button type="button" onClick={onBack} title="返回作品资料"><ArrowLeft size={17} /></button><div><span>{project?.title || '未命名作品'} / 正文写作</span><strong>{title}</strong></div><div className="nf-writing-top-actions"><span>{busy === 'save' ? '保存中…' : notice || '本地自动保存已启用'}</span>{busy && busy !== 'save' && <button type="button" className="nf-secondary-button nf-stop-button" onClick={stopActiveRequest}><Square size={13} />停止</button>}<button type="button" className="nf-secondary-button" onClick={() => setToolsOpen(true)}><Sparkles size={14} />创作工具</button><button type="button" className="nf-secondary-button" onClick={() => { setExportError(''); setExportOpen(true) }} disabled={Boolean(busy)}><Download size={14} />导出作品</button><button type="button" className="nf-secondary-button" onClick={save} disabled={Boolean(busy)}><Save size={14} />保存</button></div></header>
    <div className="nf-writing-grid">
      <aside className="nf-chapter-rail"><div className="nf-rail-heading"><span>章节 <small>{chapters.length}</small></span><div><button type="button" title="新建章节" onClick={() => openChapterDialog('create')}><Plus size={15} /></button><button type="button" title="章节回收站" onClick={openTrash}><Trash2 size={14} /></button><button type="button" title="刷新章节" onClick={() => refreshProject()}><Sparkles size={14} /></button></div></div>{chapters.map((chapter) => <div className={`nf-chapter-row-wrap ${chapter.id === activeChapter?.id ? 'is-active' : ''}`} key={chapter.id}><button type="button" className="nf-chapter-row" onClick={() => selectChapter(chapter.id)}><span>第 {chapter.id} 章</span><strong>{chapter.title || '待命名章节'}</strong><small>{chapter.status || '待写'} · {chapterWords(chapter)} 字</small></button><button type="button" className="nf-chapter-menu-button" title={`编辑第 ${chapter.id} 章`} onClick={() => openChapterDialog('rename', chapter)}><Pencil size={13} /></button></div>)}</aside>
      <main className="nf-editor-pane"><div className="nf-editor-meta"><span>{activeChapter?.status || '草稿'}</span><span>目标：{activeChapter?.goal || '推进主线，并在结尾留下新的钩子。'}</span></div><input className="nf-chapter-title" value={title} readOnly aria-label="章节标题" /><textarea ref={editorRef} className="nf-editor" value={draft} onChange={(event) => setDraft(event.target.value)} onSelect={reportSelection} onKeyUp={reportSelection} onMouseUp={reportSelection} placeholder="从这里开始写下这一章…" /><footer className="nf-editor-footer"><span>{wordCount.toLocaleString('zh-CN')} 字</span><span>第 {activeChapter?.id || '—'} 章</span><button type="button" onClick={() => sendPrompt('请续写本章正文。')} disabled={Boolean(busy)}><WandSparkles size={14} />续写</button></footer>{selection && <div className="nf-selection-actions"><span>{actionLabel}</span><button type="button" onClick={() => chapterAction('rewrite')} disabled={Boolean(busy)}><PenLine size={14} />改写</button><button type="button" onClick={() => chapterAction('condense')} disabled={Boolean(busy)}>精简</button><button type="button" onClick={() => { sendPrompt(`请分析并优化这段文字：${selection.text}`); setSelection(null) }}><MessageCircleMore size={14} />问阿流</button></div>}</main>
      <aside className="nf-ai-panel"><header><div className="nf-ai-avatar"><Bot size={18} /></div><div><strong>阿流</strong><span>正在读取当前作品与章节上下文</span></div></header><div className="nf-ai-tools"><button type="button" onClick={() => sendPrompt('请给我三个能推动当前章节的转折方向。')} disabled={Boolean(busy)}><Sparkles size={14} />给我下一步</button><button type="button" onClick={() => sendPrompt('请生成本章正文。')} disabled={Boolean(busy)}><WandSparkles size={14} />{busy === 'continue' ? '生成中…' : '生成本章正文'}</button><button type="button" onClick={() => sendPrompt('请检查当前章节的人物动机和伏笔是否一致。')} disabled={Boolean(busy)}><FileCheck2 size={14} />检查一致性</button></div>{notice && <div className="nf-ai-notice">{notice}</div>}{proposal && <section className="nf-ai-proposal"><strong>{proposal.title}</strong>{proposal.type === 'text' ? <p>{proposal.content}</p> : proposal.actions.length ? proposal.actions.map((action) => <article key={`${action.target}-${action.label}`}><span>{action.label}</span><p>{action.reason}</p><small>{action.after}</small></article>) : <p>没有可自动应用的正文修改。</p>}<div><button type="button" onClick={() => setProposal(null)}>放弃</button><button type="button" className="nf-primary-button" onClick={applyProposal}>确认应用</button></div></section>}<div className="nf-chat-list">{messages.map((item, index) => <article className={`nf-chat-message ${item.role} ${item.error ? 'is-error' : ''}`} key={`${item.role}-${index}`}><span>{item.role === 'assistant' ? '阿' : '我'}</span><div><p>{item.content}</p>{item.evidence?.length > 0 && <small>参考：{item.evidence.map((evidence) => evidence.title).join('、')}</small>}{item.action === 'show-editor' && <button type="button" onClick={showEditor}>查看编辑器</button>}{item.role === 'assistant' && !item.error && !item.status && item.instruction && <div className="nf-chat-message-actions"><button type="button" onClick={() => insertAssistantText(item)} disabled={Boolean(busy)}>写入正文</button><button type="button" onClick={() => createAssistantProposal(item)} disabled={Boolean(busy)}>生成修改预览</button></div>}</div></article>)}{busy === 'chat' || busy === 'preview' || busy === 'continue' ? <article className="nf-chat-message assistant"><span>阿</span><div className="nf-chat-loading"><LoaderCircle size={15} />{busy === 'continue' ? '正在生成本章正文…' : '阿流正在思考…'}</div></article> : null}<div ref={chatEndRef} /></div><form className="nf-chat-input" onSubmit={sendMessage}><textarea value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleMessageKeyDown} placeholder="问阿流关于这一章的任何问题…" rows="3" /><button type="submit" title="发送给阿流" disabled={Boolean(busy) || !message.trim()}><ArrowUp size={17} /></button></form></aside>
    </div>{toolsOpen && <WritingToolsPanel project={project} chapter={activeChapter} onClose={() => setToolsOpen(false)} onApplyResult={applyToolResult} />}{chapterDialog && <div className="nf-chapter-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeChapterDialog()}><form className="nf-chapter-dialog" role="dialog" aria-modal="true" onSubmit={submitChapter}><header><div><span>{chapterDialog.mode === 'rename' ? '章节设置' : '新建章节'}</span><h2>{chapterDialog.mode === 'rename' ? `编辑第 ${chapterDialog.chapter.id} 章` : '添加下一章'}</h2></div><button type="button" title="关闭" onClick={closeChapterDialog}><X size={17} /></button></header><label>章节名称<input autoFocus value={chapterTitle} onChange={(event) => setChapterTitle(event.target.value)} maxLength="100" required /></label>{chapterDialog.mode === 'create' && <label>章节目标<textarea value={chapterGoal} onChange={(event) => setChapterGoal(event.target.value)} maxLength="1500" placeholder="这一章要推进什么？" /></label>}{chapterError && <p className="nf-chapter-dialog-error">{chapterError}</p>}<footer>{chapterDialog.mode === 'rename' && <button type="button" className="nf-danger-action" onClick={removeCurrentChapter} disabled={busy === 'chapter'}><Trash2 size={14} />{deleteConfirm ? '再次点击确认删除' : '删除章节'}</button>}<span /><button type="button" className="nf-secondary-button" onClick={closeChapterDialog}>取消</button><button type="submit" className="nf-primary-button" disabled={busy === 'chapter' || !chapterTitle.trim()}>{busy === 'chapter' ? <><LoaderCircle size={14} />保存中…</> : '保存章节'}</button></footer></form></div>}{trashOpen && <div className="nf-chapter-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTrashOpen(false)}><section className="nf-chapter-dialog nf-chapter-trash" role="dialog" aria-modal="true" aria-labelledby="chapter-trash-title"><header><div><span>章节回收站</span><h2 id="chapter-trash-title">恢复误删章节</h2></div><button type="button" title="关闭" onClick={() => setTrashOpen(false)}><X size={17} /></button></header><p>恢复后系统会自动插回原位置、重新编号，并同步该章正文和记忆。</p><div className="nf-chapter-trash-list">{trashItems.length ? trashItems.map((item) => <article key={item.trashId}><div><strong>{item.chapter?.title || '未命名章节'}</strong><span>删除于 {item.deletedAt ? new Date(item.deletedAt).toLocaleString('zh-CN') : '未知时间'}</span></div><button type="button" onClick={() => restoreFromTrash(item)} disabled={busy !== ''}>{busy === `restore:${item.trashId}` ? <LoaderCircle size={14} /> : <><RotateCcw size={14} />恢复</>}</button></article>) : <p>{busy === 'trash' ? '正在读取回收站…' : '回收站为空。'}</p>}</div>{trashError && <p className="nf-chapter-dialog-error">{trashError}</p>}</section></div>}
    {exportOpen && <div className="nf-chapter-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setExportOpen(false)}><section className="nf-chapter-dialog nf-export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title"><header><div><span>作品导出</span><h2 id="export-title">下载当前作品</h2></div><button type="button" title="关闭导出" onClick={() => setExportOpen(false)}><X size={17} /></button></header><p>导出读取已保存的章节，不会修改或删除你的作品。</p>{exportError && <p className="nf-chapter-dialog-error">{exportError}</p>}<div className="nf-export-options"><button type="button" onClick={() => exportWork('docx')} disabled={Boolean(busy)}><Download size={18} /><span><strong>Word 文档</strong><small>适合继续编辑和打印</small></span></button><button type="button" onClick={() => exportWork('epub')} disabled={Boolean(busy)}><Download size={18} /><span><strong>EPUB 电子书</strong><small>适合阅读器和发布</small></span></button><button type="button" onClick={() => exportWork('json')} disabled={Boolean(busy)}><Download size={18} /><span><strong>JSON 备份</strong><small>保留作品数据，便于迁移</small></span></button></div><footer><span>{activeChapter && draft !== String(activeChapter.body || '') ? '当前章节有未保存修改' : '导出前请确认已保存最新内容'}</span><button type="button" className="nf-secondary-button" onClick={() => setExportOpen(false)}>取消</button></footer></section></div>}
  </div>
}

export default WritingRoom
