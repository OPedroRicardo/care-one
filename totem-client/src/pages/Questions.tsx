import { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Perguntas () {
  const navigate = useNavigate()

  const navToVitals = () => {
    navigate('/pre-vitals', { viewTransition: true })
  }

  const [currQuestion, setCurrQuestion] = useState(0)
  const [answers, setAnswers] = useState([] as string[])

  const questions = [
    'Você está sentindo falta de ar ou dificuldade para respirar neste momento?',
    'Você está sentindo dor ou pressão no peito agora?',
    'Nas últimas 24 horas, você sentiu uma piora repentina da sua saúde?',
    'Você possui alguma dessas condições? diabetes, pressão alta, doença cardíaca ou pulmonar',
    'Você está usando oxigênio com máscara ou cateter nasal neste momento?',
  ]

  const setAnswer = (val: string) => {
    setAnswers([...answers ?? [], val])
    setCurrQuestion(i => i+1)
  }

  const resetForm = () => setCurrQuestion(0)

  return (
  <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center animate-fade-in-up">
    <h1 className="mada-bold pt-10 pb-4">Perguntas Clínicas</h1>
    {
      currQuestion > questions.length - 1 ?

      (<section className="flex flex-col gap-10 animate-fade-in-up">
        <div className="text-center text-3xl">Por favor, verifique se suas respostas estão corretas.</div>
        {questions.map((question, idx) => (
          <div key={idx} style={{ animationDelay: `${idx * 80}ms` }} className="animate-fade-in-up">
            <div  className="px-10 pb-2 text-3xl">
              <strong>P</strong>: {question}
            </div>

            <div className="px-10 text-4xl">
              <strong>R:</strong> {answers[idx] === 'S' ? 'Sim' : 'Não'}
            </div>
          </div>
        ))}

        <div className="mx-auto flex gap-4">
          <button className="secondary" onClick={resetForm}>Recomeçar</button>
          <button className="primary w-75" onClick={navToVitals}>Enviar</button>
        </div>
      </section>) :

    (<div key={currQuestion} className="flex flex-col items-center animate-fade-in-up">
      <div className="text-4xl mada-medium">Pergunta {currQuestion + 1} / {questions.length}</div>

      <div className="w-[calc(100vw-120px)] max-w-md h-2 bg-primary-lighter rounded-full overflow-hidden my-6">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((currQuestion) / questions.length) * 100}%` }}
        />
      </div>

      <div className="text-center px-22.5 text-4xl">{ questions[currQuestion] }</div>

      <div className="pt-6 flex gap-10">
        <button
          className="negative"
          onClick={() => setAnswer('N')}
        >Não</button>

        <button
          className="positive"
          onClick={() => setAnswer('S')}
        >Sim</button>
      </div>
      </div>)
    }
  </main>
  )
}