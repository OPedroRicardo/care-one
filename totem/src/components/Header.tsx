import { ArrowLeft } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

export default function Header() {
  const location = useLocation()
  const navigate = useNavigate()

  const donnotShowHeader = () => {
    const blackList = ['/']

    return blackList.includes(location.pathname)
  }

  const showBackBtn = () => {
    const blackList = ['/login', '/score/loading', '/score/result', '/fallback']

    return !blackList.includes(location.pathname)
  }

  return (
    <header
      style={{ display: donnotShowHeader() ? 'none' : 'flex' }}
      className="w-full pt-15 px-13 justify-between items-center fixed top-0"
    >
      {
        showBackBtn() ?
        (<button
          className="p-5"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft color="#0079C8" size={40} />
        </button>) : <div></div>
      }
      <img src="/careplus.svg" alt="Care Plus" />
    </header>
  )
}