import { createBrowserRouter, RouterProvider } from "react-router-dom"

import App                from '../App'
import Home               from '../pages/Home'
import Chat               from '../pages/Chat'
import ChatList           from '../pages/ChatList'
import HistoryList        from '../pages/HistoryList'
import HistoryDetails     from '../pages/HistoryDetails'
import OperadoraDashboard from '../pages/OperadoraDashboard'
import MedicoDashboard    from '../pages/MedicoDashboard'
import MedicoConversa     from '../pages/MedicoConversa'
import PacienteDashboard  from '../pages/PacienteDashboard'
import PacienteConversa   from '../pages/PacienteConversa'
import VideoCall          from '../pages/VideoCall'
import { PlatformTourProvider } from '../tour/PlatformTourProvider'

export const router = createBrowserRouter([
  { path: "/operadora", element: <OperadoraDashboard /> },
  {
    path: "/",
    element: <App />,
    children: [
      { index: true,                                    element: <Home /> },
      { path: "medico",                                 element: <MedicoDashboard /> },
      { path: "medico/conversa/:patientName",           element: <MedicoConversa /> },
      { path: "paciente",                               element: <PacienteDashboard /> },
      { path: "paciente/conversa",                      element: <PacienteConversa /> },
      { path: "videochamada/:appointmentId",            element: <VideoCall /> },
      { path: "chat",                                   element: <Chat /> },
      { path: "chat/:id",                               element: <Chat /> },
      { path: "chats",                                  element: <ChatList /> },
      { path: "history",                                element: <HistoryList /> },
      { path: "history/:id",                            element: <HistoryDetails /> },
    ]
  },
]);

export default function Router () {
  return (
    <PlatformTourProvider>
      <RouterProvider router={router} />
    </PlatformTourProvider>
  )
}
