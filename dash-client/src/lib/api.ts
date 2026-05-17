const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error ?? res.statusText)
  }
  return res.json()
}

export type SSEEvent =
  | { type: 'token';  value: string }
  | { type: 'done';   sources: string[] }
  | { type: 'error';  error: string }

export async function* apiStream(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error ?? res.statusText)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const data = line.replace(/^data: /, '').trim()
      if (!data) continue
      yield JSON.parse(data) as SSEEvent
    }
  }
}
