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

export default function ScoreResult () {
  const navigate = useNavigate()
  const location = useLocation()
  const score: NEWS2Score = location.state?.score

  return (
    <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center gap-10">
      <h1 className="text-center mada-bold">Pontuação NEWS2</h1>

      <div className="flex flex-col items-center gap-2">
        <span className="text-9xl mada-bold text-primary">{score?.total ?? '--'}</span>
        <span className="text-2xl">ponto(s)</span>
      </div>

      <button className="primary" onClick={() => navigate('/')}>Voltar ao início</button>
    </main>
  )
}
