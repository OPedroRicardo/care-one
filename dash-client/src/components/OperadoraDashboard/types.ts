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
  /** Present on live, DB-backed beneficiaries bridged from the Paciente/Médico world. */
  live?: boolean
  recentActivity?: {
    latestTriagem: { summary: string; date: number; riskLevel: string | null } | null
    sharedExams: { examType: string; date: number }[]
    nextAppointment: { type: string; status: string; scheduledAt: number } | null
  }
}

export type SortKey = 'compositeScore' | 'age' | 'framingham' | 'homaIR' | 'projectedCost' | 'alteredCount'
