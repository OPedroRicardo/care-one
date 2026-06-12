import { Outlet } from "react-router";
import './index.css'
import Header from './components/Header'
import { HeaderTabsProvider } from './contexts/HeaderTabsContext'

export default function App() {
  return (
    <HeaderTabsProvider>
      <div className="min-h-screen bg-white mada-regular">
        <Header />
        <Outlet />
      </div>
    </HeaderTabsProvider>
  )
}
