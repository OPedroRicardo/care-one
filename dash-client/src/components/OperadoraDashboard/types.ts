export interface LabPoint {
  date: string
  glucose: number
  insulin: number
  totalChol: number
  ldl: number
  hdl: number
  triglycerides: number
  sysBP: number
  diaBP: number
}

export interface Patient {
  id: number
  name: string
  age: number
  sex: 'M' | 'F'
  smoker: boolean
  diabetic: boolean
  medicated: boolean
  prevInternacao: boolean
  consultas12m: number
  diasUltimoExame: number
  exams: LabPoint[]
  homaIR: number
  framingham: number
  compositeScore: number
  confidence: number
  riskLevel: 'alto' | 'medio' | 'baixo'
  alteredCount: number
  alteredMarkers: boolean[]
  trendGlucose: number
  trendChol: number
  projectedCost: number
}

export type SortKey = 'compositeScore' | 'age' | 'framingham' | 'homaIR' | 'projectedCost' | 'alteredCount'
