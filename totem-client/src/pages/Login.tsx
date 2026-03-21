import { useNavigate } from "react-router-dom"

export default function Login () {
  const navigate = useNavigate()

  const handleLogin = (formData: FormData) => {
    console.log('login', formData)
    navigate('/questions', { viewTransition: true })
  }

  return (
  <main className="h-[calc(100vh)] text-primary-dark flex flex-col justify-center items-center">
    <h1 className="mada-bold pb-3.5">Identificação</h1>
    <form className="w-full flex flex-col items-center" action={handleLogin}>
      <div className="w-full px-22.5 flex flex-col gap-5 mb-20">
        <label
          htmlFor="cpf"
          className="text-[24px]"
        >CPF</label>
        <input
          className="text-[24px]"
          name="cpf"
          type="tel"
          placeholder="Digite seu CPF aqui"
        />
      </div>
      <button className="primary" type="submit">Entrar</button>
    </form>
  </main>
  )
}