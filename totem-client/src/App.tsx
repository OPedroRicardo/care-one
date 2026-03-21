import { Outlet } from "react-router";
import './index.css'
import Header from './components/Header'

export default function App() {
  return (
    <section className="h-full text-[2.8rem] mada-regular">
      <Header />
      <Outlet />
    </section>
  )
}
