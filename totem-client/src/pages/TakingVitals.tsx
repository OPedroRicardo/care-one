import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { HeartPulse, Gauge, Activity, Wind, Thermometer, CheckCircle2, Loader2 } from "lucide-react"

const steps = [
  { key: 'fc', label: 'Frequência Cardíaca', icon: HeartPulse },
  { key: 'pa', label: 'Pressão Arterial', icon: Gauge },
  { key: 'spo2', label: 'Saturação de Oxigênio', icon: Activity },
  { key: 'fr', label: 'Frequência Respiratória', icon: Wind },
  { key: 'temp', label: 'Temperatura Corporal', icon: Thermometer },
]

export default function TakingVitals () {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (current >= steps.length) {
      const timeout = setTimeout(() => navigate('/vitals-result', { replace: true, viewTransition: true }), 700)
      return () => clearTimeout(timeout)
    }

    const timeout = setTimeout(() => setCurrent(c => c + 1), 1300)
    return () => clearTimeout(timeout)
  }, [current, navigate])

  const progress = (Math.min(current, steps.length) / steps.length) * 100

  return (
    <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center gap-12 animate-fade-in-up">
      <h1 className="text-center mada-bold pb-3.5">Coletando<br/>Sinais Vitais...</h1>

      <div className="w-[calc(100vw-120px)] max-w-md h-3 bg-primary-lighter rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ul className="flex flex-col gap-6 w-full px-22.5">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const done = idx < current
          const active = idx === current

          return (
            <li
              key={step.key}
              className={`flex items-center gap-4 text-2xl transition-all duration-500 ${idx <= current ? 'opacity-100' : 'opacity-30'}`}
            >
              <span
                className={`p-3 rounded-full transition-colors duration-300 ${
                  done
                    ? 'bg-primary text-white'
                    : active
                    ? 'bg-primary-lighter text-primary animate-pulse-ring'
                    : 'bg-primary-lighter/50 text-primary-light'
                }`}
              >
                <Icon size={28} />
              </span>
              <span className="flex-1">{step.label}</span>
              {done && <CheckCircle2 className="text-success animate-scale-in" size={28} />}
              {active && <Loader2 className="animate-spin text-primary" size={28} />}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
