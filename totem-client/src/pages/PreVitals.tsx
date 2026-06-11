import { useNavigate } from "react-router-dom"

export default function PreVitals () {
  const navigate = useNavigate()

  return (
  <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center animate-fade-in-up">
    <h1 className="text-center mada-bold pb-3.5">Coleta de Sinais Vitais</h1>
    <button className="primary" onClick={() => navigate('/taking-vitals', { viewTransition: true })}>Iniciar Coleta</button>
  </main>
  )
}