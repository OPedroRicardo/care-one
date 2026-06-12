import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Stethoscope, UserRound, ChevronRight, Presentation } from 'lucide-react'
import ProductTour, { type Step } from '../components/ProductTour'

const PROFILES = [
  {
    id:          'operadora',
    label:       'Operadora de Saúde',
    description: 'Análise preditiva de sinistros, carteira de beneficiários e ROI',
    Icon:        ShieldCheck,
    href:        '/operadora',
    color:       '#0079C8',
    bg:          '#EBF5FF',
  },
  {
    id:          'medico',
    label:       'Médico',
    description: 'Painel de pacientes, agenda de consultas e exames compartilhados',
    Icon:        Stethoscope,
    href:        '/medico',
    color:       '#7C3AED',
    bg:          '#F5F3FF',
  },
  {
    id:          'paciente',
    label:       'Paciente',
    description: 'Meu painel de saúde, consultas agendadas e histórico clínico',
    Icon:        UserRound,
    href:        '/paciente',
    color:       '#16A34A',
    bg:          '#F0FDF4',
  },
]

const TOUR_STEPS: Step[] = [
  {
    target: '[data-tour="intro"]',
    title: 'Bem-vindo ao Care One',
    content: 'Esta é uma demonstração da plataforma. Você pode alternar entre os perfis a qualquer momento a partir desta tela.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="operadora"]',
    title: 'Operadora de Saúde',
    content: 'Análise preditiva de sinistros: carteira de beneficiários, risco por paciente e ROI de intervenções preventivas.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="medico"]',
    title: 'Médico',
    content: 'Painel clínico: lista de pacientes, agenda de consultas (com videochamada) e exames compartilhados.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="paciente"]',
    title: 'Paciente',
    content: 'Painel pessoal de saúde: triagens, consultas, conversa com o médico, exames e integrações com wearables.',
    placement: 'top',
  },
  {
    target: '[data-tour="tour-button"]',
    title: 'Refazer o tour',
    content: 'Você pode reabrir este tour a qualquer momento clicando aqui.',
    placement: 'left',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const [runTour, setRunTour] = useState(false)

  return (
    <section className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center px-6 py-16">
      <ProductTour steps={TOUR_STEPS} run={runTour} onClose={() => setRunTour(false)} />

      <div className="mb-10 text-center" data-tour="intro">
        <p className="text-xs font-semibold tracking-widest text-[#0079C8] uppercase mb-2">Care One</p>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Bem-vindo</h1>
        <p className="text-sm text-slate-500 mt-1.5">Selecione seu perfil para continuar</p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        {PROFILES.map(({ id, label, description, Icon, href, color, bg }) => (
          <button
            key={id}
            data-tour={id}
            onClick={() => navigate(href)}
            className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4 hover:shadow-md transition-all group"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: bg, color }}
            >
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
          </button>
        ))}
      </div>

      {/* Floating "start tour" button */}
      <button
        data-tour="tour-button"
        onClick={() => setRunTour(true)}
        title="Iniciar tour guiado"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#0079C8] text-white shadow-lg hover:bg-[#0060a0] hover:shadow-xl flex items-center justify-center transition-all"
      >
        <Presentation size={22} />
      </button>
    </section>
  )
}
