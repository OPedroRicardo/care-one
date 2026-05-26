import type { LabPoint, Patient } from './types'

// ─── MATH ────────────────────────────────────────────────────────────────────

function lcg(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function gaussian(rng: () => number, mean: number, std: number) {
  const u1 = rng(), u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2)
  return Math.max(mean - 3.5 * std, Math.min(mean + 4 * std, mean + z * std))
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function linReg(vals: number[]) {
  const n = vals.length
  if (n < 2) return 0
  const mx = (n - 1) / 2
  const my = vals.reduce((a, b) => a + b) / n
  const num = vals.reduce((s, v, i) => s + (i - mx) * (v - my), 0)
  const den = vals.reduce((s, _, i) => s + (i - mx) ** 2, 0)
  return den === 0 ? 0 : parseFloat((num / den).toFixed(2))
}

// ─── CLINICAL CALCULATIONS ───────────────────────────────────────────────────

const calcHOMAIR = (g: number, i: number) => parseFloat(((g * i) / 405).toFixed(2))

function calcFramingham(age: number, sex: 'M' | 'F', tc: number, hdl: number, sbp: number, smoker: boolean, diabetic: boolean) {
  let pts = 0
  if (sex === 'M') {
    pts += age < 35 ? -1 : age < 40 ? 0 : age < 45 ? 1 : age < 50 ? 2 : age < 55 ? 3 : age < 60 ? 4 : age < 65 ? 5 : age < 70 ? 6 : 7
    pts += tc < 160 ? -3 : tc < 200 ? 0 : tc < 240 ? 1 : tc < 280 ? 2 : 3
    pts += hdl < 35 ? 2 : hdl < 45 ? 1 : hdl < 50 ? 0 : hdl < 60 ? -1 : -2
    pts += sbp < 120 ? -3 : sbp < 130 ? 0 : sbp < 140 ? 1 : sbp < 160 ? 2 : 3
    if (smoker) pts += 2
    if (diabetic) pts += 2
    const map = [1,2,2,3,4,4,6,7,9,11,14,18,22,27,33,40,47,56]
    return map[clamp(pts + 3, 0, 17)]
  } else {
    pts += age < 35 ? -9 : age < 40 ? -4 : age < 45 ? 0 : age < 50 ? 3 : age < 55 ? 6 : age < 60 ? 7 : 8
    pts += tc < 160 ? -2 : tc < 200 ? 0 : tc < 240 ? 1 : tc < 280 ? 2 : 3
    pts += hdl < 35 ? 5 : hdl < 45 ? 2 : hdl < 50 ? 1 : hdl < 60 ? 0 : -2
    pts += sbp < 120 ? -3 : sbp < 130 ? 0 : sbp < 140 ? 1 : sbp < 160 ? 2 : 3
    if (smoker) pts += 2
    if (diabetic) pts += 4
    const map = [1,2,2,3,3,4,5,6,7,8,9,11,13,15,17,20,24,27,32]
    return map[clamp(pts + 2, 0, 18)]
  }
}

function calcComposite(fram: number, homa: number, sbp: number, altered: number, conf: number) {
  const fN = clamp(fram / 45, 0, 1)
  const hN = clamp(homa / 5.5, 0, 1)
  const bN = clamp((sbp - 110) / 70, 0, 1)
  const mN = altered / 7
  const raw = 0.35 * fN + 0.25 * hN + 0.20 * bN + 0.20 * mN
  return parseFloat((sigmoid(8 * (raw - 0.42)) * 100 * conf).toFixed(1))
}

function isAltered(key: string, val: number, sex: 'M' | 'F') {
  if (key === 'glucose') return val > 99
  if (key === 'insulin') return val > 25
  if (key === 'totalChol') return val >= 200
  if (key === 'ldl') return val >= 130
  if (key === 'hdl') return val < (sex === 'F' ? 50 : 40)
  if (key === 'triglycerides') return val >= 150
  if (key === 'sysBP') return val >= 130
  return false
}

// ─── DATA GENERATION ─────────────────────────────────────────────────────────

const MEN = ['Alexandre','Bruno','Carlos','Daniel','Eduardo','Felipe','Gustavo','Henrique','Igor','João','Leandro','Marcelo','Nelson','Otávio','Pedro','Rafael','Sérgio','Thiago','Vitor','Wellington','André','Bernardo','Cláudio','Diego','Ernesto','Francisco','Gilberto','Hélio','Ivo','Jorge']
const WOMEN = ['Ana','Beatriz','Carla','Diana','Elisa','Fernanda','Gabriela','Helena','Isabela','Juliana','Karina','Lúcia','Mariana','Natália','Olívia','Patrícia','Roberta','Sandra','Tatiana','Vanessa','Adriana','Bruna','Cristina','Débora','Érica','Fátima','Giovanna','Hosana','Irene','Jéssica']
const SURNAMES = ['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira','Lima','Gomes','Costa','Ribeiro','Martins','Carvalho','Almeida','Lopes','Sousa','Fernandes','Vieira','Barbosa','Rocha','Dias','Nascimento','Andrade','Moreira','Nunes','Marques','Machado','Mendes','Freitas']
const MARKERS = ['glucose','insulin','totalChol','ldl','hdl','triglycerides','sysBP'] as const

function generatePatients(): Patient[] {
  const rng = lcg(42)
  const now = new Date('2026-05-25')
  const patients: Patient[] = []

  for (let i = 0; i < 80; i++) {
    const tier = i < 24 ? 'alto' : i < 56 ? 'medio' : 'baixo'
    const sex: 'M' | 'F' = rng() > 0.52 ? 'M' : 'F'
    const age = Math.round(clamp(gaussian(rng, tier === 'alto' ? 58 : tier === 'medio' ? 47 : 36, 8), 25, 75))
    const smoker = tier === 'alto' ? rng() > 0.45 : tier === 'medio' ? rng() > 0.75 : rng() > 0.92
    const diabetic = tier === 'alto' ? rng() > 0.42 : tier === 'medio' ? rng() > 0.78 : rng() > 0.96
    const medicated = diabetic || (tier !== 'baixo' && rng() > 0.5)
    const prevInternacao = tier === 'alto' ? rng() > 0.52 : rng() > 0.88
    const consultas12m = Math.round(clamp(gaussian(rng, tier === 'alto' ? 7 : tier === 'medio' ? 4 : 2, 2), 0, 15))
    const diasUltimoExame = Math.round(clamp(gaussian(rng, tier === 'alto' ? 48 : 90, 30), 7, 180))

    const gM = tier === 'alto' ? 140 : tier === 'medio' ? 106 : 88
    const iM = tier === 'alto' ? 22 : tier === 'medio' ? 13 : 7
    const tcM = tier === 'alto' ? 248 : tier === 'medio' ? 215 : 178
    const ldlM = tier === 'alto' ? 168 : tier === 'medio' ? 138 : 105
    const hdlM = tier === 'alto' ? (sex === 'F' ? 42 : 33) : tier === 'medio' ? (sex === 'F' ? 51 : 42) : (sex === 'F' ? 62 : 54)
    const tgM = tier === 'alto' ? 225 : tier === 'medio' ? 158 : 105
    const sysM = tier === 'alto' ? 152 : tier === 'medio' ? 134 : 116
    const diaM = tier === 'alto' ? 95 : tier === 'medio' ? 84 : 74
    const trend = tier === 'alto' ? 1.6 : tier === 'medio' ? 0.3 : -0.2

    const exams: LabPoint[] = []
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now); d.setMonth(d.getMonth() - m)
      const o = (5 - m) * trend
      exams.push({
        date: d.toISOString().slice(0, 7),
        glucose: Math.round(clamp(gaussian(rng, gM + o * 0.8, 12), 60, 310)),
        insulin: parseFloat(clamp(gaussian(rng, iM + o * 0.4, 3), 1, 60).toFixed(1)),
        totalChol: Math.round(clamp(gaussian(rng, tcM + o * 0.5, 18), 100, 360)),
        ldl: Math.round(clamp(gaussian(rng, ldlM + o * 0.4, 15), 40, 260)),
        hdl: Math.round(clamp(gaussian(rng, hdlM - o * 0.15, 7), 15, 105)),
        triglycerides: Math.round(clamp(gaussian(rng, tgM + o * 0.6, 25), 40, 510)),
        sysBP: Math.round(clamp(gaussian(rng, sysM + o * 0.3, 10), 88, 225)),
        diaBP: Math.round(clamp(gaussian(rng, diaM + o * 0.2, 8), 55, 135)),
      })
    }

    const lat = exams[5]
    const homaIR = calcHOMAIR(lat.glucose, lat.insulin)
    const framingham = calcFramingham(age, sex, lat.totalChol, lat.hdl, lat.sysBP, smoker, diabetic)
    const alteredMarkers = MARKERS.map(k => isAltered(k, lat[k], sex))
    const alteredCount = alteredMarkers.filter(Boolean).length
    const confidence = clamp(0.55 + 0.07 * exams.length + 0.04 * alteredCount, 0.6, 0.97)
    const compositeScore = calcComposite(framingham, homaIR, lat.sysBP, alteredCount, confidence)
    const riskLevel: Patient['riskLevel'] = compositeScore >= 55 ? 'alto' : compositeScore >= 28 ? 'medio' : 'baixo'
    const trendGlucose = linReg(exams.map(e => e.glucose))
    const trendChol = linReg(exams.map(e => e.totalChol))
    const baseCost = compositeScore >= 55 ? 68000 : compositeScore >= 28 ? 28000 : 7500
    const projectedCost = Math.round(clamp(gaussian(rng, baseCost, baseCost * 0.22), 3000, 150000))
    const nameArr = sex === 'M' ? MEN : WOMEN
    const name = `${nameArr[Math.floor(rng() * nameArr.length)]} ${SURNAMES[Math.floor(rng() * SURNAMES.length)]}`

    patients.push({
      id: i + 1, name, age, sex, smoker, diabetic, medicated, prevInternacao,
      consultas12m, diasUltimoExame, exams,
      homaIR, framingham, compositeScore, confidence,
      riskLevel, alteredCount, alteredMarkers,
      trendGlucose, trendChol, projectedCost,
    })
  }
  return patients.sort((a, b) => b.compositeScore - a.compositeScore)
}

export const PATIENTS = generatePatients()
