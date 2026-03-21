import { useNavigate } from 'react-router-dom'
import careFullLogo from '../assets/careplus-full.svg'
import footerImg from '../assets/home-footer.png'

export default function Home () {
  const navigate = useNavigate();

  const navToLogin = () => {
    navigate('/login', { viewTransition: true });
  }

  return (
    <section
      className="flex flex-col items-center mt-32.5 gap-45.5"
      onClick={navToLogin}
    >
    <header className="w-full px-14 flex justify-center items-center">
      <img src={careFullLogo} alt="Care Plus. Part of Bupa" />
    </header>
    <main className="text-center">
      <h1 className="mada-bold text-primary">Seja bem-vindo(a) à triagem!</h1>
      <h2 className="text-primary">Clique na tela para iniciar.</h2>
    </main>
    <footer className="absolute flex justify-end align-bottom w-full h-127 right-0 left-0 bottom-0 overflow-hidden">
      <img
        className="w-full object-cover right-0 object-top"
        src={footerImg}
        alt="Família reunida e feliz vendo exames."
      />
    </footer>
  </section>
  )
}