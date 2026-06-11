import { useLocation, useNavigate } from "react-router-dom";

type NEWS2Score = {
  fr: number;
  pa: number;
  fc: number;
  temp: number;
  spo2: number;
  airOxygen: number;
  total: number;
}

const getRiskColor = (total?: number) => {
  if (total === undefined) return 'text-primary'
  if (total >= 7) return 'text-negative'
  if (total >= 5) return 'text-warning'
  return 'text-success'
}

export default function ScoreResult () {
  const navigate = useNavigate()
  const location = useLocation()
  const score: NEWS2Score = location.state?.score

  return (
    <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center gap-10 animate-fade-in-up">
      <h1 className="text-center mada-bold">Pontuação NEWS2</h1>

      <div className="flex flex-col items-center gap-2 animate-scale-in">
        <span className={`text-9xl mada-bold ${getRiskColor(score?.total)}`}>{score?.total ?? '--'}</span>
        <span className="text-2xl">ponto(s)</span>
      </div>

      <button className="primary" onClick={() => navigate('/', { viewTransition: true })}>Voltar ao início</button>
    </main>
  )
}
