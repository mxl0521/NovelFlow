// Keep the legacy writing room compatible with background model tasks.
(() => {
  const nativeFetch = window.fetch.bind(window)
  const jsonResponse = (payload, status) => new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json' },
  })
  const delay = (signal) => new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, 900)
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })

  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input, options)
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined))
    try {
      const session = JSON.parse(window.localStorage.getItem('novelflow.session') || 'null')
      if (session?.accessToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.accessToken}`)
    } catch { /* Storage may be unavailable. */ }
    const signal = options.signal || (input instanceof Request ? input.signal : undefined)
    const response = await nativeFetch(input, { ...options, headers, signal })
    if (response.status !== 202) return response
    const queued = await response.clone().json().catch(() => ({}))
    if (!queued.taskId) return response
    const deadline = Date.now() + 600_000
    let failures = 0
    while (Date.now() < deadline) {
      await delay(signal)
      let polled
      try {
        polled = await nativeFetch(`/api/ai-tasks/${encodeURIComponent(queued.taskId)}`, { headers, signal })
      } catch (error) {
        if (error.name === 'AbortError' || ++failures > 3) throw error
        continue
      }
      if ([502, 503, 504].includes(polled.status) && ++failures <= 3) continue
      if (!polled.ok) return polled
      failures = 0
      const task = await polled.json()
      if (['queued', 'running'].includes(task.status)) continue
      return jsonResponse(task.result || { error: '后台任务没有返回结果' }, task.httpStatus || (task.status === 'completed' ? 200 : 502))
    }
    return jsonResponse({ error: '等待模型结果时间过长，后台可能仍在执行，请稍后刷新查看结果' }, 504)
  }
})()
