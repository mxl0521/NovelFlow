const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ACTIVE_MODEL_KEY = 'novelflow.activeModelId'
const SESSION_KEY = 'novelflow.session'
let activeProjectId = ''

function storedActiveModelId() {
  try { return window.localStorage.getItem(ACTIVE_MODEL_KEY) || '' } catch { return '' }
}

function storedSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistSession(session) {
  activeProjectId = ''
  try {
    if (session && session.accessToken) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(SESSION_KEY)
  } catch { /* ignore storage failures */ }
}

export function getActiveModelId() { return storedActiveModelId() }
export function setActiveModelId(id) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_MODEL_KEY, id)
    else window.localStorage.removeItem(ACTIVE_MODEL_KEY)
  } catch { /* localStorage may be unavailable in restricted browser contexts */ }
}

export function getStoredSession() {
  return storedSession()
}

export function setStoredSession(session) {
  persistSession(session)
}

export function clearStoredSession() {
  persistSession(null)
}

function withActiveModel(payload = {}) {
  const profileId = storedActiveModelId()
  if (!profileId) throw new Error('请先在设置中配置并测试一个模型，再开始 AI 创作')
  return { ...payload, profileId }
}

function httpError(response, payload, fallback) {
  const defaults = {
    401: '登录已失效，请重新登录',
    503: '服务器暂时不可用（HTTP 503），可能是请求超时或服务重启，请稍后重试',
    504: '服务器请求超时（HTTP 504），请稍后重试',
  }
  const error = new Error(payload.error || defaults[response.status] || `${fallback}（HTTP ${response.status}）`)
  error.status = response.status
  return error
}

function pollingDelay(signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      window.clearTimeout(timer)
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', aborted)
      resolve()
    }, 900)
    signal?.addEventListener('abort', aborted, { once: true })
    if (signal?.aborted) aborted()
  })
}

async function request(path, options = {}) {
  const session = storedSession()
  const headers = { ...(options.headers || {}) }
  if (session && session.accessToken) headers.Authorization = 'Bearer ' + session.accessToken
  const projectOperation = /^\/api\/(project(?:\/|$)|chapter\/|assistant(?:\/|$)|workflow\/)/.test(path) && !['/api/project/create', '/api/project/bootstrap', '/api/project/clarify'].includes(path)
  if (activeProjectId && projectOperation) headers['X-Project-Id'] = activeProjectId
  const response = await fetch(path, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (response.status === 202 && payload.taskId) {
    const result = await pollAiTask(payload.taskId, session, options.signal)
    if (result.project?.id) activeProjectId = result.project.id
    return result
  }
  if (!response.ok) {
    throw httpError(response, payload, '请求失败，请稍后重试')
  }
  if (Object.hasOwn(payload, 'project')) activeProjectId = payload.project?.id || ''
  return payload
}

async function pollAiTask(taskId, session, signal) {
  // Model generations can legitimately take several minutes. The initial
  // request is asynchronous (202), so polling does not hold an Heroku HTTP
  // request open and avoids the router's 30-second H12 limit.
  const deadline = Date.now() + 1_200_000
  let transientFailures = 0
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
    await pollingDelay(signal)
    const headers = {}
    if (session?.accessToken) headers.Authorization = 'Bearer ' + session.accessToken
    let response
    try {
      response = await fetch(`/api/ai-tasks/${encodeURIComponent(taskId)}`, { headers, signal })
    } catch (error) {
      if (error.name === 'AbortError' || ++transientFailures > 3) throw error
      continue
    }
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if ([502, 503, 504].includes(response.status) && ++transientFailures <= 3) continue
      if (response.status === 404) payload.error = '未找到后台任务，服务可能已重启，请刷新页面查看已保存结果'
      throw httpError(response, payload, '后台任务查询失败，请稍后重试')
    }
    transientFailures = 0
    if (payload.status === 'queued' || payload.status === 'running') continue
    const result = payload.result || {}
    if (payload.status !== 'completed' || Number(payload.httpStatus || 200) >= 400) {
      const error = new Error(result.error || '后台模型任务失败，请稍后重试')
      error.status = Number(payload.httpStatus || 502)
      throw error
    }
    return result
  }
  const error = new Error(`等待后台任务结果已达上限，任务可能仍在执行。请刷新查看已保存结果，任务编号：${taskId}`)
  error.status = 504
  throw error
}

export const fetchSessionConfig = () => request('/api/session/config')
export const fetchCurrentUser = () => request('/api/session/me')
export async function signIn(email, password) {
  const payload = await request('/api/session/sign-in', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email, password }) })
  if (payload.session && payload.session.accessToken) persistSession(payload.session)
  return payload
}
export async function signUp(email, password, displayName) {
  const payload = await request('/api/session/sign-up', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email, password, displayName }) })
  if (payload.session && payload.session.accessToken) persistSession(payload.session)
  return payload
}
export async function signOut() {
  try {
    await request('/api/session/sign-out', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({}) })
  } finally {
    persistSession(null)
  }
}

export const updateProfile = (displayName) => request('/api/session/profile', {
  method: 'POST',
  headers: JSON_HEADERS,
  body: JSON.stringify({ displayName }),
})

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
  return request('/api/models/configure', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(model) })
}
export async function testModel(id) {
  return request('/api/models/test', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
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
export const uploadProjectCover = (dataUrl) => request('/api/project/cover', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ dataUrl }) })
export const saveChapter = (chapter) => request('/api/project/chapters/save', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id: chapter.id, body: chapter.body, summary: chapter.goal || '', baseRevision: chapter.revision }) })
export const refreshStoryDossier = (chapterId = '', projectId = activeProjectId) => request('/api/project/dossier/refresh', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(withActiveModel({ chapterId, projectId })) })

const dossierSchedules = new Map()
export function scheduleDossierRefresh(projectId, chapterId) {
  const key = `${storedSession()?.accessToken || ''}:${projectId}`
  const existing = dossierSchedules.get(key)
  if (existing) {
    existing.chapterId = chapterId
    existing.again = true
    return existing.promise
  }
  const entry = { chapterId, again: false }
  entry.promise = (async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 800))
    let result
    do {
      entry.again = false
      // Do not run an old user's scheduled request after signing out/in.
      if (key !== `${storedSession()?.accessToken || ''}:${projectId}`) throw new Error('登录会话已变化，请重新同步资料')
      result = await refreshStoryDossier(entry.chapterId, projectId)
    } while (entry.again)
    return result
  })().finally(() => dossierSchedules.delete(key))
  dossierSchedules.set(key, entry)
  return entry.promise
}
export const createChapter = (chapter) => request('/api/project/chapters/create', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(chapter) })
export const renameChapter = (id, title) => request('/api/project/chapters/rename', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id, title }) })
export const deleteChapter = (id) => request('/api/project/chapters/delete', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ id }) })
export const fetchChapterTrash = () => request('/api/project/chapters/trash')
export const restoreChapter = (trashId) => request('/api/project/chapters/restore', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ trashId }) })
export const runChapterAction = (chapterId, operation, range, signal, instruction = '') => request('/api/chapter/continue', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ chapterId, operation, range, instruction })) })
export function askAssistant(message, history, chapterId, signal) {
  const recentHistory = (Array.isArray(history) ? history : [])
    .filter((item) => ['user', 'assistant'].includes(item?.role) && !item.error && !item.status && typeof item.content === 'string' && item.content.trim())
    .slice(-10)
    .map(({ role, content }) => ({ role, content: content.trim().slice(0, 1200) }))
  return request('/api/assistant', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ message, history: recentHistory, chapterId })) })
}
export const fetchAssistantHistory = (chapterId) => request(`/api/project/assistant/history?chapterId=${encodeURIComponent(chapterId)}`)
export const previewAssistantActions = (chapterId, instruction, assistantReply, currentDraft, signal) => request('/api/assistant/action-preview', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ chapterId, instruction, assistantReply, currentDraft })) })
export const checkConsistency = (chapterId, focus = 'all') => request('/api/project/consistency', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(withActiveModel({ chapterId, focus })) })
export const runWorkflow = (chapterId, agentIds, runId, signal, resumeTaskId = '') => request('/api/workflow/run', { method: 'POST', headers: JSON_HEADERS, signal, body: JSON.stringify(withActiveModel({ chapterId, agentIds, runId, resumeTaskId })) })
export const cancelWorkflow = (runId) => request('/api/workflow/cancel', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ runId }) })
export const applyWorkflow = (runId, acceptedAgents, acceptedDecisions = []) => request('/api/workflow/apply', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ runId, acceptedAgents, acceptedDecisions }) })
export const fetchWorkflowTasks = () => request('/api/workflow/tasks')
export const searchMemory = (query) => request('/api/project/memory/search', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ query }) })
