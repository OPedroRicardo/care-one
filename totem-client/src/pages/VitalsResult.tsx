import { useNavigate } from "react-router-dom";

export default function PreVitals () {
  const navigate = useNavigate()

  type resultType = {
    type: 'fr' | 'spo2' | 'temp' | 'pa' | 'fc';
    val: number
  }

  const resultStrategy = Object.freeze({
    fr: {
      label: 'Frequência respiratória (FR)',
      unit: 'rpm'
    },
    spo2: {
      label: 'Saturação de Oxigênio (SpO2)',
      unit: '%'
    },
    temp: {
      label: 'Temperatura Corporal',
      unit: '°C'
    },
    pa: {
      label: 'Pressão Arterial Sistólica',
      unit: 'mmHg'
    },
    fc: {
      label: 'Frequência Cardíaca (FC)',
      unit: 'bpm'
    }
  })

  const dummyResult: resultType[] = [
    { type: 'fr', val: 15 },
    { type: 'spo2', val: 97 },
    { type: 'temp', val: 37 },
    { type: 'pa', val: 110 },
    { type: 'fc', val: 70 },
  ]

  const navToPreVitals = () => {
    navigate('/pre-vitals')
  }

  return (
  <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center">
    <h1 className="text-center mada-bold pb-3.5">Resultado da<br/>Coleta de Sinais Vitais</h1>
    <table className="w-[calc(100vw-80px)] mb-10 px-20">
      <tbody className="w-full text-3xl">
        {
          dummyResult.map(({ type, val }, idx) => (
              <tr
                key={type}
                className={`flex justify-between py-4 border-b-blue-400 ${idx < dummyResult.length - 1 && 'border-b'}`}
              >
                <td>{resultStrategy[type].label}</td>
                <td>{val} {resultStrategy[type].unit}</td>
              </tr>
          ))
        }
      </tbody>
    </table>
    <div className="mx-auto flex gap-4">
      <button className="secondary" onClick={navToPreVitals}>Coletar Novamente</button>
      <button className="primary w-75">Enviar</button>
    </div>
  </main>
  )
}