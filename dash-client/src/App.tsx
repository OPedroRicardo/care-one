import { Outlet } from "react-router";
import './index.css'
import Header from './components/Header'

export default function App() {
  return (
    <div className="min-h-screen bg-white mada-regular">
      <Header />
      <Outlet />
    </div>
  )
}
