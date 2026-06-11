import { useState } from "react";
import { useNavigate } from "react-router-dom";

type resultType = {
  type: 'fr' | 'spo2' | 'temp' | 'pa' | 'fc';
  val: number
}

const resultStrategy = Object.freeze({
  fr: { label: 'Frequência respiratória (FR)', unit: 'rpm' },
  spo2: { label: 'Saturação de Oxigênio (SpO2)', unit: '%' },
  temp: { label: 'Temperatura Corporal', unit: '°C' },
  pa: { label: 'Pressão Arterial Sistólica', unit: 'mmHg' },
  fc: { label: 'Frequência Cardíaca (FC)', unit: 'bpm' },
})

const dummyResult: resultType[] = [
  { type: 'fr', val: 15 },
  { type: 'spo2', val: 97 },
  { type: 'temp', val: 37 },
  { type: 'pa', val: 110 },
  { type: 'fc', val: 70 },
]

export default function VitalsResult () {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    setLoading(true)
    setError(null)

    const vitals = {
      fr: dummyResult.find(r => r.type === 'fr')!.val,
      fc: dummyResult.find(r => r.type === 'fc')!.val,
      spo2: dummyResult.find(r => r.type === 'spo2')!.val,
      temp: dummyResult.find(r => r.type === 'temp')!.val,
      pa: dummyResult.find(r => r.type === 'pa')!.val,
      oxygen: false,
      hipercapnia: false,
    }

    try {
      const BASE = import.meta.env.VITE_API_URL ?? `http://localhost:3333`
      const res = await fetch(`${BASE}/totem/score/news2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vitals),
      })

      if (!res.ok) throw new Error(`Erro ${res.status}`)

      const data = await res.json()
      navigate('/score-result', { state: { score: data.score }, viewTransition: true })
    } catch (err) {
      setError('Falha ao enviar os dados. Tente novamente.')
      setLoading(false)
    }
  }

  return (
  <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center animate-fade-in-up">
    <h1 className="text-center mada-bold pb-3.5">Resultado da<br/>Coleta de Sinais Vitais</h1>
    <table className="w-[calc(100vw-80px)] mb-10 px-20">
      <tbody className="w-full text-3xl">
        {
          dummyResult.map(({ type, val }, idx) => (
              <tr
                key={type}
                style={{ animationDelay: `${idx * 80}ms` }}
                className={`flex justify-between py-4 border-b-blue-400 animate-fade-in-up ${idx < dummyResult.length - 1 && 'border-b'}`}
              >
                <td>{resultStrategy[type].label}</td>
                <td>{val} {resultStrategy[type].unit}</td>
              </tr>
          ))
        }
      </tbody>
    </table>

    {error && (
      <p className="mb-4 text-red-500 text-xl animate-fade-in-up">{error}</p>
    )}

    <div className="mx-auto flex gap-4">
      <button className="secondary" onClick={() => navigate('/pre-vitals', { viewTransition: true })}>Coletar Novamente</button>
      <button className="primary w-75" onClick={handleSend} disabled={loading}>
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
    </div>
  </main>
  )
}