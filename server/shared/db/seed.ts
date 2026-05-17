/**
 * Script de seeding para a tabela history_records.
 * Execução: tsx shared/db/seed.ts
 */

import { db } from './index.ts'
import { historyRecords } from './schema.ts'

type TriagemDetails = {
  riskLevel: 'baixo' | 'moderado' | 'alto'
  vitals: {
    heartRate: number
    bloodPressure: string
    temperature: number
    oxygenSaturation: number
    respiratoryRate: number
  }
  news2Score: number
  notes: string
}

type ExameDetails = {
  examName: string
  results: Array<{
    item: string
    value: string
    reference: string
    status: 'normal' | 'alterado'
  }>
  notes: string
}

const seeds: Array<{
  id: string
  type: 'triagem' | 'exame'
  patientName: string
  date: number
  summary: string
  details: TriagemDetails | ExameDetails
}> = [
  {
    id: 'seed-triagem-001',
    type: 'triagem',
    patientName: 'João da Silva',
    date: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 dias atrás
    summary: 'Triagem de rotina — risco baixo',
    details: {
      riskLevel: 'baixo',
      vitals: {
        heartRate: 72,
        bloodPressure: '120/80',
        temperature: 36.5,
        oxygenSaturation: 98,
        respiratoryRate: 16,
      },
      news2Score: 1,
      notes: 'Paciente assintomático, sem queixas relevantes. Aguarda consulta de rotina.',
    } satisfies TriagemDetails,
  },
  {
    id: 'seed-triagem-002',
    type: 'triagem',
    patientName: 'João da Silva',
    date: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 dias atrás
    summary: 'Triagem com sinais vitais alterados — risco moderado',
    details: {
      riskLevel: 'moderado',
      vitals: {
        heartRate: 95,
        bloodPressure: '145/92',
        temperature: 37.8,
        oxygenSaturation: 95,
        respiratoryRate: 20,
      },
      news2Score: 5,
      notes: 'Paciente refere dor de cabeça e cansaço. Pressão arterial elevada. Encaminhado para avaliação médica com prioridade moderada.',
    } satisfies TriagemDetails,
  },
  {
    id: 'seed-triagem-003',
    type: 'triagem',
    patientName: 'João da Silva',
    date: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 dias atrás
    summary: 'Triagem de urgência — risco alto',
    details: {
      riskLevel: 'alto',
      vitals: {
        heartRate: 112,
        bloodPressure: '170/105',
        temperature: 38.9,
        oxygenSaturation: 91,
        respiratoryRate: 26,
      },
      news2Score: 9,
      notes: 'Paciente com dificuldade respiratória, febre alta e hipoxemia. Encaminhado imediatamente para atendimento de emergência.',
    } satisfies TriagemDetails,
  },
  {
    id: 'seed-exame-001',
    type: 'exame',
    patientName: 'João da Silva',
    date: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 dias atrás
    summary: 'Hemograma Completo — resultados normais',
    details: {
      examName: 'Hemograma Completo',
      results: [
        { item: 'Hemoglobina',    value: '14.2 g/dL',  reference: '13.5–17.5 g/dL',  status: 'normal'   },
        { item: 'Hematócrito',    value: '42%',         reference: '41–53%',           status: 'normal'   },
        { item: 'Leucócitos',     value: '7.800 /µL',   reference: '4.000–11.000 /µL', status: 'normal'   },
        { item: 'Plaquetas',      value: '210.000 /µL', reference: '150.000–400.000',  status: 'normal'   },
        { item: 'VCM',            value: '88 fL',       reference: '80–100 fL',        status: 'normal'   },
      ],
      notes: 'Hemograma dentro dos limites da normalidade. Sem alterações significativas.',
    } satisfies ExameDetails,
  },
  {
    id: 'seed-exame-002',
    type: 'exame',
    patientName: 'João da Silva',
    date: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 dias atrás
    summary: 'Perfil Lipídico — colesterol elevado',
    details: {
      examName: 'Perfil Lipídico',
      results: [
        { item: 'Colesterol Total', value: '228 mg/dL', reference: '< 200 mg/dL',  status: 'alterado' },
        { item: 'LDL',              value: '152 mg/dL', reference: '< 130 mg/dL',  status: 'alterado' },
        { item: 'HDL',              value: '45 mg/dL',  reference: '> 40 mg/dL',   status: 'normal'   },
        { item: 'Triglicerídeos',   value: '155 mg/dL', reference: '< 150 mg/dL',  status: 'alterado' },
      ],
      notes: 'Colesterol total e LDL acima do ideal. Recomendada avaliação nutricional e possível início de terapia hipolipemiante.',
    } satisfies ExameDetails,
  },
  {
    id: 'seed-exame-003',
    type: 'exame',
    patientName: 'João da Silva',
    date: Date.now() - 20 * 24 * 60 * 60 * 1000, // 20 dias atrás
    summary: 'Função Tireoidiana — dentro da normalidade',
    details: {
      examName: 'Função Tireoidiana (TSH + T4 Livre)',
      results: [
        { item: 'TSH',     value: '2.1 mUI/L',  reference: '0.4–4.0 mUI/L',   status: 'normal' },
        { item: 'T4 Livre', value: '1.2 ng/dL', reference: '0.8–1.8 ng/dL',   status: 'normal' },
      ],
      notes: 'Função tireoidiana eutireoidea. Sem evidências de hipo ou hipertireoidismo.',
    } satisfies ExameDetails,
  },
]

async function seed() {
  console.log('🌱 Iniciando seeding de history_records...')

  for (const record of seeds) {
    await db
      .insert(historyRecords)
      .values({
        id:          record.id,
        type:        record.type,
        patientName: record.patientName,
        date:        record.date,
        summary:     record.summary,
        details:     JSON.stringify(record.details),
        createdAt:   Date.now(),
      })
      .onConflictDoNothing()

    console.log(`  ✓ ${record.type} — ${record.summary}`)
  }

  console.log('✅ Seeding concluído!')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Erro no seeding:', err)
  process.exit(1)
})
