// Clinical utility functions (kept for potential client-side use)
// Patient data now comes from GET /api/app/operadora/patients

export function calcHOMAIR(glucose: number, insulin: number) {
  return parseFloat(((glucose * insulin) / 405).toFixed(2))
}

export function linReg(vals: number[]) {
  const n = vals.length
  if (n < 2) return 0
  const mx = (n - 1) / 2
  const my = vals.reduce((a, b) => a + b) / n
  const num = vals.reduce((s, v, i) => s + (i - mx) * (v - my), 0)
  const den = vals.reduce((s, _, i) => s + (i - mx) ** 2, 0)
  return den === 0 ? 0 : parseFloat((num / den).toFixed(2))
}
