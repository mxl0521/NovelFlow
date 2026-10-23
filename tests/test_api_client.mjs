import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import * as api from '../web-ui/src/api.js'

const storage = new Map()
const localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }
const fastTimeout = (callback) => setTimeout(callback, 0)
const reply = (status, payload) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  storage.clear()
  storage.set('novelflow.session', JSON.stringify({ accessToken: 'test-user' }))
  storage.set('novelflow.activeModelId', 'test-model')
  globalThis.window = { localStorage, setTimeout: fastTimeout, clearTimeout }
})

test('non-JSON Heroku 503 reports the status', async () => {
  globalThis.fetch = async () => new Response('<html>unavailable</html>', { status: 503 })
  await assert.rejects(api.refreshStoryDossier(), (error) => error.status === 503 && error.message.includes('HTTP 503'))
})

test('polling survives a transient 503 without resubmitting generation', async () => {
  const responses = [reply(202, { taskId: 'task' }), reply(503, {}), reply(200, { status: 'running' }), reply(200, { status: 'completed', httpStatus: 200, result: { ok: true } })]
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return responses.shift() }
  assert.deepEqual(await api.refreshStoryDossier(), { ok: true })
  assert.equal(calls.filter(({ options }) => options.method === 'POST').length, 1)
  assert.equal(calls.length, 4)
  assert.ok(calls.every(({ options }) => options.headers.Authorization === 'Bearer test-user'))
})

test('model failure is returned with its actual message and status', async () => {
  const responses = [reply(202, { taskId: 'task' }), reply(200, { status: 'failed', httpStatus: 502, result: { error: '中转站返回 403' } })]
  globalThis.fetch = async () => responses.shift()
  await assert.rejects(api.refreshStoryDossier(), (error) => error.status === 502 && error.message === '中转站返回 403')
  assert.equal(responses.length, 0)
})

test('expired session during polling stops immediately with login message', async () => {
  let calls = 0
  globalThis.fetch = async () => ++calls === 1 ? reply(202, { taskId: 'task' }) : reply(401, {})
  await assert.rejects(api.refreshStoryDossier(), (error) => error.status === 401 && error.message.includes('重新登录'))
  assert.equal(calls, 2)
})

test('long assistant history fits the request limit and sends only valid recent messages', async () => {
  let sent
  globalThis.fetch = async (_url, options) => { sent = options.body; return reply(200, { reply: '回复' }) }
  const history = Array.from({ length: 30 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: '中文'.repeat(2000) }))
  history.push({ role: 'system', content: 'invalid' }, { role: 'user', content: '' }, { role: 'assistant', content: '不要发送的报错', error: true }, { role: 'assistant', content: '不要发送的操作提示', status: true })
  await api.askAssistant('中文'.repeat(2000), history, '01')
  assert.equal(JSON.parse(sent).history.length, 10)
  assert.ok(Buffer.byteLength(sent, 'utf8') < 64_000)
  assert.ok(!sent.includes('不要发送'))
})

test('completed poll delays remove abort listeners', async () => {
  const controller = new AbortController()
  let listeners = 0
  const add = controller.signal.addEventListener.bind(controller.signal)
  const remove = controller.signal.removeEventListener.bind(controller.signal)
  controller.signal.addEventListener = (...args) => { listeners++; add(...args) }
  controller.signal.removeEventListener = (...args) => { listeners--; remove(...args) }
  const responses = [reply(202, { taskId: 'task' }), reply(200, { status: 'running' }), reply(200, { status: 'completed', result: { reply: '回复' } })]
  globalThis.fetch = async () => responses.shift()
  await api.askAssistant('继续', [], '01', controller.signal)
  assert.equal(listeners, 0)
})

test('aborted generation stops before a task poll', async () => {
  const controller = new AbortController()
  let calls = 0
  globalThis.fetch = async () => { calls++; controller.abort(); return reply(202, { taskId: 'task' }) }
  await assert.rejects(api.askAssistant('继续', [], '01', controller.signal), { name: 'AbortError' })
  assert.equal(calls, 1)
})

test('legacy writing room receives completed results and preserves authentication', async () => {
  const calls = []
  const responses = [reply(202, { taskId: 'legacy' }), reply(200, { status: 'running' }), reply(200, { status: 'completed', httpStatus: 200, result: { reply: '旧界面回复' } })]
  const legacyWindow = {
    localStorage, location: { href: 'https://novelflow.test/novelflow-legacy.html', origin: 'https://novelflow.test' },
    fetch: async (url, options) => { calls.push({ url, options }); return responses.shift() },
  }
  const source = await readFile(new URL('../web-ui/public/async-model-requests.js', import.meta.url), 'utf8')
  vm.runInNewContext(source, { window: legacyWindow, Response, Request, Headers, URL, DOMException, setTimeout: fastTimeout, clearTimeout })
  const response = await legacyWindow.fetch('/api/assistant', { method: 'POST' })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { reply: '旧界面回复' })
  assert.ok(calls.every(({ options }) => options.headers.get('Authorization') === 'Bearer test-user'))
})
