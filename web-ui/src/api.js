const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ACTIVE_MODEL_KEY = 'novelflow.activeModelId'

function storedActiveModelId() {
  try { return window.localStorage.getItem(ACTIVE_MODEL_KEY) || '' } catch { return '' }
}

export function getActiveModelId() { return storedActiveModelId() }
export function setActiveModelId(id) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_MODEL_KEY, id)
    else window.localStorage.removeItem(ACTIVE_MODEL_KEY)
  } catch { /* localStorage may be unavailable in restricted browser contexts */ }
}

function withActiveModel(payload = {}) {
  const profileId = storedActiveModelId()
  if (!profileId) throw new Error('请先在设置中配置并测试一个模型，再开始 AI 创作')
  return { ...payload, profileId }
}

async function request(path, options = {}) {
  const response = await fetch(path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '请求失败，请稍后重试')
  return payload
}

export const fetchProject = () => request('/api/project')
export async function fetchModels() {
  const payload = await request('/api/models')
  const models = payload.models || []
  const active = models.find((item) => item.id === storedActiveModelId() && item.configured)
  const configured = models.find((item) => item.configured)
  if (active?.id) setActiveModelId(active.id)
  else if (configured?.id) setActiveModelId(configured.id)
  else setActiveModelId('')
  return payload
}
export async function configureModel(model) {
  const response = await request('/api/models/configure', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(model) })
  setActiveModelId(model.id)
  return response
}
export async function testModel(id) {
  const response = await request('/api/models/test', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
  setActiveModelId(id)
  return response
}
export const removeModel = (id) => request('/api/models/remove', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
export const fetchProjects = async () => {
  const payload = await request('/api/projects')
  return { ...payload, projects: (payload.projects || []).filter((item) => item?.id) }
}
export const selectProject = (id) => request('/api/projects/select', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
export const removeProject = (id) => request('/api/projects/remove', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
export const fetchProjectTrash = () => request('/api/projects/trash')
export const restoreProject = (id) => request('/api/projects/restore', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
export const exportProjectJson = (id) => request('/api/projects/export', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
export const exportProjectFile = (id, format) => request('/api/projects/export-file', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id, format }) })
export const requestClarifications = (settings) => request('/api/project/clarify', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(withActiveModel({ settings })) })
export const generateBlueprint = (settings, feedback = '') => request('/api/project/bootstrap', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(withActiveModel({ settings, feedback })) })
export const createProject = (settings, blueprint) => request('/api/project/create', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(withActiveModel({ settings, blueprint })) })
export const saveChapter = (chapter) => request('/api/project/chapters/save', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id: chapter.id, body: chapter.body, summary: chapter.goal || '', baseRevision: chapter.revision }) })
export const refreshStoryDossier = (chapterId = '') => request('/api/project/dossier/refresh', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(withActiveModel({ chapterId })) })
export const createChapter = (chapter) => request('/api/project/chapters/create', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(chapter) })
export const renameChapter = (id, title) => request('/api/project/chapters/rename', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id, title }) })
export const deleteChapter = (id) => request('/api/project/chapters/delete', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
export const fetchChapterTrash = () => request('/api/project/chapters/trash')
export const restoreChapter = (trashId) => request('/api/project/chapters/restore', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ trashId }) })
export const runChapterAction = (chapterId, operation, range, signal, instruction = '') => request('/api/chapter/continue', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ chapterId, operation, range, instruction })) })
export const askAssistant = (message, history, chapterId, signal) => request('/api/assistant', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ message, history, chapterId })) })
export const fetchAssistantHistory = (chapterId) => request(`/api/project/assistant/history?chapterId=${encodeURIComponent(chapterId)}`)
export const previewAssistantActions = (chapterId, instruction, assistantReply, currentDraft, signal) => request('/api/assistant/action-preview', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ chapterId, instruction, assistantReply, currentDraft })) })
export const checkConsistency = (chapterId, focus = 'all') => request('/api/project/consistency', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(withActiveModel({ chapterId, focus })) })
export const runWorkflow = (chapterId, agentIds, runId, signal, resumeTaskId = '') => request('/api/workflow/run', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ chapterId, agentIds, runId, resumeTaskId })) })
export const cancelWorkflow = (runId) => request('/api/workflow/cancel', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ runId }) })
export const applyWorkflow = (runId, acceptedAgents, acceptedDecisions = []) => request('/api/workflow/apply', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ runId, acceptedAgents, acceptedDecisions }) })
export const fetchWorkflowTasks = () => request('/api/workflow/tasks')
export const searchMemory = (query) => request('/api/project/memory/search', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ query }) })
