import { desc } from 'drizzle-orm'
import { db }             from '../../shared/db/index.ts'
import { historyRecords } from '../../shared/db/schema.ts'

// These mirror the shapes stored as JSON in history_records.details
interface VitalsRecord {
  heartRate:        number
  bloodPressure:    string
  temperature:      number
  oxygenSaturation: number
  respiratoryRate:  number
}

interface TriagemDetails {
  riskLevel:  'baixo' | 'moderado' | 'alto'
  vitals:     VitalsRecord
  news2Score: number
  notes:      string
}

interface ExameResult {
  item:      string
  value:     string
  reference: string
  status:    'normal' | 'alterado'
}

interface ExameDetails {
  examName: string
  results:  ExameResult[]
  notes:    string
}

// Hard cap to keep the LLM context manageable
const MAX_RECORDS = 20

export class PatientDataService {
  /**
   * Fetches all clinical history records from the DB and formats them into a
   * plain-text block suitable for injection into the LLM system prompt.
   */
  async buildContext(): Promise<string> {
    const rows = await db
      .select()
      .from(historyRecords)
      .orderBy(desc(historyRecords.date))
      .limit(MAX_RECORDS)

    if (rows.length === 0) {
      return 'Nenhum registro clínico encontrado para este paciente.'
    }

    const sections: string[] = []

    // Prepend a risk alert banner based on the latest triagem
    const latestTriagem = rows.find(r => r.type === 'triagem')
    if (latestTriagem) {
      try {
        const d = JSON.parse(latestTriagem.details) as TriagemDetails
        if (d.riskLevel === 'alto') {
          sections.push(`⚠️ ALERTA CLÍNICO: Última triagem indica RISCO ALTO (NEWS2: ${d.news2Score}). Avaliação emergencial necessária.`)
        } else if (d.riskLevel === 'moderado') {
          sections.push(`⚡ ATENÇÃO CLÍNICA: Última triagem indica RISCO MODERADO (NEWS2: ${d.news2Score}). Avaliação médica urgente recomendada.`)
        }
      } catch { /* ignore malformed entry */ }
    }

    const records = rows
      .map((row, index) => {
        const date = new Date(row.date).toLocaleDateString('pt-BR')
        let details: unknown = null
        try {
          details = JSON.parse(row.details)
        } catch { /* malformed DB entry — render header only */ }
        return PatientDataService.#formatRecord(row.type, row.patientName, row.summary, date, details, index === 0)
      })
      .join('\n\n---\n\n')

    sections.push(records)
    return sections.join('\n\n')
  }

  static #formatRecord(
    type:        string,
    patientName: string,
    summary:     string,
    date:        string,
    details:     unknown,
    isLatest     = false,
  ): string {
    const kind   = type === 'triagem' ? 'Triagem' : 'Exame'
    const label  = isLatest ? ' ★ MAIS RECENTE' : ''
    const header = `[${kind} | ${date} | Paciente: ${patientName}${label}]\nResumo: ${summary}`

    if (!details || typeof details !== 'object') return header

    if (type === 'triagem') {
      const d = details as TriagemDetails
      const v = d.vitals ?? {}
      return [
        header,
        `Nível de risco: ${d.riskLevel ?? '—'} | Escore NEWS2: ${d.news2Score ?? '—'}`,
        `Sinais vitais: FC ${v.heartRate} bpm, PA ${v.bloodPressure}, Temp ${v.temperature}°C, SpO2 ${v.oxygenSaturation}%, FR ${v.respiratoryRate} rpm`,
        `Observações: ${d.notes ?? '—'}`,
      ].join('\n')
    }

    if (type === 'exame') {
      const d = details as ExameDetails
      const results = Array.isArray(d.results)
        ? d.results.map(r => `  - ${r.item}: ${r.value} (referência: ${r.reference}) — ${r.status}`).join('\n')
        : '  Sem resultados disponíveis.'
      return [
        header,
        `Exame: ${d.examName ?? '—'}`,
        `Resultados:\n${results}`,
        `Observações: ${d.notes ?? '—'}`,
      ].join('\n')
    }

    return header
  }
}
