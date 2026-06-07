/**
 * Seed: history_records, appointments, exams
 * Execução: cd server && yarn db:seed
 */
import { db } from './index.ts'
import { historyRecords, appointments, exams } from './schema.ts'

const D = (daysAgo: number) => Date.now() - daysAgo * 24 * 60 * 60 * 1000
const F = (daysFromNow: number) => Date.now() + daysFromNow * 24 * 60 * 60 * 1000

// ── Helpers ──────────────────────────────────────────────────────────────────

const triagem = (
  id: string, patient: string, daysAgo: number, summary: string,
  risk: 'baixo' | 'médio' | 'alto',
  vitals: { fc: number; fr: number; spo2: number; temp: number; pa: number },
  news2total: number, notes: string,
) => ({
  id,
  type: 'triagem' as const,
  patientName: patient,
  date: D(daysAgo),
  summary,
  details: JSON.stringify({ riskLevel: risk, vitals, news2: { total: news2total }, notes }),
  createdAt: D(daysAgo),
})

const exame = (
  id: string, patient: string, daysAgo: number, examName: string, summary: string,
  results: { item: string; value: string; reference: string; status: 'normal' | 'alterado' }[],
  notes: string,
) => ({
  id,
  type: 'exame' as const,
  patientName: patient,
  date: D(daysAgo),
  summary,
  details: JSON.stringify({ examName, results, notes }),
  createdAt: D(daysAgo),
})

// ── History Records ───────────────────────────────────────────────────────────

const historySeeds = [
  // ── João da Silva — alto risco, histórico extenso ─────────────────────────
  triagem('t-joao-1', 'João da Silva', 2, 'Triagem de urgência — risco alto',
    'alto', { fc: 118, fr: 25, spo2: 91, temp: 38.9, pa: 172 }, 9,
    'Paciente com dispneia, febre alta e hipoxemia. Encaminhado para emergência.'),

  triagem('t-joao-2', 'João da Silva', 10, 'Triagem com PA elevada — risco médio',
    'médio', { fc: 96, fr: 20, spo2: 95, temp: 37.6, pa: 148 }, 5,
    'Paciente refere cefaleia e cansaço. Pressão arterial elevada. Encaminhado para avaliação prioritária.'),

  triagem('t-joao-3', 'João da Silva', 30, 'Triagem de rotina — risco baixo',
    'baixo', { fc: 74, fr: 15, spo2: 98, temp: 36.6, pa: 122 }, 1,
    'Paciente assintomático. Sinais vitais dentro da normalidade.'),

  exame('e-joao-1', 'João da Silva', 5, 'Hemograma Completo', 'Hemograma — resultados normais', [
    { item: 'Hemoglobina',  value: '14.2 g/dL',  reference: '13.5–17.5 g/dL',  status: 'normal'   },
    { item: 'Leucócitos',   value: '7.800 /µL',   reference: '4.000–11.000 /µL', status: 'normal'   },
    { item: 'Plaquetas',    value: '210.000 /µL', reference: '150.000–400.000',  status: 'normal'   },
  ], 'Hemograma dentro dos limites da normalidade.'),

  exame('e-joao-2', 'João da Silva', 12, 'Perfil Lipídico', 'Perfil lipídico — colesterol elevado', [
    { item: 'Colesterol Total', value: '232 mg/dL', reference: '< 200 mg/dL', status: 'alterado' },
    { item: 'LDL',              value: '158 mg/dL', reference: '< 130 mg/dL', status: 'alterado' },
    { item: 'HDL',              value: '43 mg/dL',  reference: '> 40 mg/dL',  status: 'normal'   },
    { item: 'Triglicerídeos',   value: '162 mg/dL', reference: '< 150 mg/dL', status: 'alterado' },
  ], 'Colesterol e LDL acima do ideal. Orientado sobre dieta e atividade física.'),

  // ── Ana Lima — risco médio ─────────────────────────────────────────────────
  triagem('t-ana-1', 'Ana Lima', 3, 'Triagem — risco médio, glicemia elevada',
    'médio', { fc: 88, fr: 18, spo2: 96, temp: 37.2, pa: 138 }, 4,
    'Paciente refere poliúria e sede intensa. Glicemia capilar: 182 mg/dL.'),

  triagem('t-ana-2', 'Ana Lima', 20, 'Triagem de rotina — risco baixo',
    'baixo', { fc: 76, fr: 16, spo2: 97, temp: 36.8, pa: 118 }, 2,
    'Sinais vitais estáveis. Glicemia controlada após ajuste de medicação.'),

  exame('e-ana-1', 'Ana Lima', 8, 'Hemoglobina Glicada (HbA1c)', 'HbA1c — diabetes descompensada', [
    { item: 'HbA1c', value: '8.2%', reference: '< 7.0%', status: 'alterado' },
  ], 'HbA1c acima da meta. Reajuste de insulina indicado.'),

  exame('e-ana-2', 'Ana Lima', 15, 'Glicemia de Jejum', 'Glicemia de jejum elevada', [
    { item: 'Glicemia Jejum', value: '178 mg/dL', reference: '70–99 mg/dL', status: 'alterado' },
  ], 'Hiperglicemia em jejum. Reforçada orientação nutricional.'),

  // ── Maria Fernanda — risco alto, complicações ──────────────────────────────
  triagem('t-maria-1', 'Maria Fernanda', 1, 'Triagem de urgência — risco alto',
    'alto', { fc: 130, fr: 28, spo2: 88, temp: 39.4, pa: 185 }, 12,
    'Paciente em crise hipertensiva com insuficiência respiratória. Encaminhada à UTI.'),

  triagem('t-maria-2', 'Maria Fernanda', 8, 'Triagem pós-internação — risco médio',
    'médio', { fc: 92, fr: 19, spo2: 94, temp: 37.9, pa: 145 }, 6,
    'Alta hospitalar. Medicação ajustada. Em acompanhamento ambulatorial.'),

  exame('e-maria-1', 'Maria Fernanda', 4, 'Troponina', 'Troponina I — elevada', [
    { item: 'Troponina I', value: '2.8 ng/mL', reference: '< 0.04 ng/mL', status: 'alterado' },
  ], 'Troponina marcantemente elevada. Investigação cardíaca em andamento.'),

  // ── Carlos Santos — risco baixo, jovem saudável ───────────────────────────
  triagem('t-carlos-1', 'Carlos Santos', 6, 'Triagem de rotina — saudável',
    'baixo', { fc: 68, fr: 14, spo2: 99, temp: 36.4, pa: 112 }, 0,
    'Jovem atleta, assintomático. Realiza triagem preventiva anual.'),

  exame('e-carlos-1', 'Carlos Santos', 6, 'Hemograma + Bioquímica', 'Check-up — resultados normais', [
    { item: 'Glicemia',    value: '88 mg/dL',  reference: '70–99 mg/dL',   status: 'normal' },
    { item: 'Creatinina',  value: '1.0 mg/dL', reference: '0.7–1.2 mg/dL', status: 'normal' },
    { item: 'TGO',         value: '22 U/L',    reference: '< 40 U/L',      status: 'normal' },
    { item: 'TGP',         value: '18 U/L',    reference: '< 40 U/L',      status: 'normal' },
  ], 'Bioquímica sérica dentro dos limites da normalidade. Excelente saúde geral.'),

  // ── Beatriz Oliveira — risco alto, idosa com múltiplas comorbidades ────────
  triagem('t-beatriz-1', 'Beatriz Oliveira', 4, 'Triagem — risco alto, taquicardia',
    'alto', { fc: 128, fr: 22, spo2: 92, temp: 38.1, pa: 160 }, 8,
    'Idosa 72 anos, taquicardia persistente e dessaturação. Histórico de ICC.'),

  triagem('t-beatriz-2', 'Beatriz Oliveira', 21, 'Triagem — risco médio',
    'médio', { fc: 94, fr: 20, spo2: 94, temp: 37.4, pa: 142 }, 5,
    'Controle ambulatorial pós-crise. Medicação em ajuste.'),

  exame('e-beatriz-1', 'Beatriz Oliveira', 7, 'BNP / NT-proBNP', 'BNP — insuficiência cardíaca', [
    { item: 'NT-proBNP', value: '1.850 pg/mL', reference: '< 125 pg/mL', status: 'alterado' },
  ], 'BNP muito elevado. Indicativo de descompensação de insuficiência cardíaca.'),

  // ── Pedro Alves — risco baixo, adulto sem comorbidades ────────────────────
  triagem('t-pedro-1', 'Pedro Alves', 14, 'Triagem de rotina — risco baixo',
    'baixo', { fc: 72, fr: 15, spo2: 98, temp: 36.7, pa: 118 }, 1,
    'Paciente sem queixas. Triagem de rotina empresarial.'),
]

// ── Appointments ──────────────────────────────────────────────────────────────

const appointmentSeeds = [
  // João da Silva — telechamada confirmada (próxima)
  {
    id: 'appt-joao-1',
    patientName: 'João da Silva',
    doctorName:  'Dr. Silva',
    type:        'telechamada' as const,
    status:      'confirmed' as const,
    scheduledAt: F(3),
    notes:       'Retorno pós-triagem de urgência. Avaliar PA e saturação.',
    createdAt:   D(2),
  },
  // João da Silva — presencial pendente
  {
    id: 'appt-joao-2',
    patientName: 'João da Silva',
    doctorName:  'Dr. Silva',
    type:        'presencial' as const,
    status:      'pending' as const,
    scheduledAt: F(10),
    notes:       'Consulta para ajuste de anti-hipertensivos.',
    createdAt:   D(1),
  },
  // Ana Lima — telechamada pendente (urgente)
  {
    id: 'appt-ana-1',
    patientName: 'Ana Lima',
    doctorName:  'Dr. Silva',
    type:        'telechamada' as const,
    status:      'pending' as const,
    scheduledAt: F(2),
    notes:       'Ajuste de insulina após HbA1c 8,2%.',
    createdAt:   D(1),
  },
  // Ana Lima — presencial confirmada
  {
    id: 'appt-ana-2',
    patientName: 'Ana Lima',
    doctorName:  'Dr. Silva',
    type:        'presencial' as const,
    status:      'confirmed' as const,
    scheduledAt: F(14),
    notes:       null,
    createdAt:   D(5),
  },
  // Maria Fernanda — presencial confirmada (retorno pós-UTI)
  {
    id: 'appt-maria-1',
    patientName: 'Maria Fernanda',
    doctorName:  'Dr. Silva',
    type:        'presencial' as const,
    status:      'confirmed' as const,
    scheduledAt: F(5),
    notes:       'Retorno pós-alta hospitalar. Verificar troponina e ECG.',
    createdAt:   D(1),
  },
  // Maria Fernanda — telechamada pendente
  {
    id: 'appt-maria-2',
    patientName: 'Maria Fernanda',
    doctorName:  'Dr. Silva',
    type:        'telechamada' as const,
    status:      'pending' as const,
    scheduledAt: F(7),
    notes:       null,
    createdAt:   D(1),
  },
  // Carlos Santos — presencial pendente (check-up)
  {
    id: 'appt-carlos-1',
    patientName: 'Carlos Santos',
    doctorName:  'Dr. Silva',
    type:        'presencial' as const,
    status:      'pending' as const,
    scheduledAt: F(20),
    notes:       'Check-up anual preventivo.',
    createdAt:   D(3),
  },
  // Beatriz Oliveira — presencial confirmada (cardio)
  {
    id: 'appt-beatriz-1',
    patientName: 'Beatriz Oliveira',
    doctorName:  'Dr. Silva',
    type:        'presencial' as const,
    status:      'confirmed' as const,
    scheduledAt: F(4),
    notes:       'Avaliação cardiológica urgente — BNP elevado.',
    createdAt:   D(2),
  },
  // Beatriz Oliveira — cancelada
  {
    id: 'appt-beatriz-2',
    patientName: 'Beatriz Oliveira',
    doctorName:  'Dr. Silva',
    type:        'telechamada' as const,
    status:      'cancelled' as const,
    scheduledAt: D(1),
    notes:       'Paciente internada de emergência.',
    createdAt:   D(5),
  },
]

// ── Exams (uploads) ───────────────────────────────────────────────────────────

const examSeeds = [
  // João — hemograma compartilhado, lipídio não compartilhado
  {
    id: 'ex-joao-1',
    patientName: 'João da Silva',
    examType:    'Hemograma',
    fileName:    'hemograma_joao_2026.pdf',
    fileData:    null,
    shared:      true,
    sharedUntil: F(5),
    createdAt:   D(5),
  },
  {
    id: 'ex-joao-2',
    patientName: 'João da Silva',
    examType:    'Perfil Lipídico',
    fileName:    'lipidico_joao_2026.pdf',
    fileData:    null,
    shared:      false,
    sharedUntil: null,
    createdAt:   D(12),
  },
  // Ana — HbA1c compartilhada
  {
    id: 'ex-ana-1',
    patientName: 'Ana Lima',
    examType:    'Hemoglobina Glicada',
    fileName:    'hba1c_ana_2026.pdf',
    fileData:    null,
    shared:      true,
    sharedUntil: F(3),
    createdAt:   D(8),
  },
  // Maria — Troponina compartilhada (urgente)
  {
    id: 'ex-maria-1',
    patientName: 'Maria Fernanda',
    examType:    'Troponina',
    fileName:    'troponina_maria_2026.pdf',
    fileData:    null,
    shared:      true,
    sharedUntil: F(7),
    createdAt:   D(4),
  },
  // Carlos — check-up compartilhado
  {
    id: 'ex-carlos-1',
    patientName: 'Carlos Santos',
    examType:    'Hemograma + Bioquímica',
    fileName:    'checkup_carlos_2026.pdf',
    fileData:    null,
    shared:      true,
    sharedUntil: F(10),
    createdAt:   D(6),
  },
  // Beatriz — BNP compartilhado
  {
    id: 'ex-beatriz-1',
    patientName: 'Beatriz Oliveira',
    examType:    'BNP / NT-proBNP',
    fileName:    'bnp_beatriz_2026.pdf',
    fileData:    null,
    shared:      true,
    sharedUntil: F(4),
    createdAt:   D(7),
  },
]

// ── Runner ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Iniciando seeding...\n')

  console.log('📋 History records...')
  for (const r of historySeeds) {
    await db.insert(historyRecords).values(r).onConflictDoNothing()
    console.log(`  ✓ [${r.type}] ${r.patientName} — ${r.summary.slice(0, 60)}`)
  }

  console.log('\n📅 Agendamentos...')
  for (const a of appointmentSeeds) {
    await db.insert(appointments).values(a).onConflictDoNothing()
    console.log(`  ✓ [${a.status}] ${a.patientName} — ${a.type} em ${new Date(a.scheduledAt).toLocaleDateString('pt-BR')}`)
  }

  console.log('\n🧪 Exames...')
  for (const e of examSeeds) {
    await db.insert(exams).values(e).onConflictDoNothing()
    console.log(`  ✓ ${e.patientName} — ${e.examType} (compartilhado: ${e.shared})`)
  }

  console.log('\n✅ Seeding concluído!')
  process.exit(0)
}

seed().catch(err => {
  console.error('❌ Erro no seeding:', err)
  process.exit(1)
})
