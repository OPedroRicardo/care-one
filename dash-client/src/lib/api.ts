const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  console.log(`${BASE}${path}`)
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  console.log({ res })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err?.error ?? res.statusText)
  }
  return res.json()
}
