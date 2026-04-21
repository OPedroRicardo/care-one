import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom"

import App            from '../App'
import Chat           from '../pages/Chat'
import HistoryList    from '../pages/HistoryList'
import HistoryDetails from '../pages/HistoryDetails'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true,            element: <Navigate to="/chat" replace /> },
      { path: "chat",           element: <Chat /> },
      { path: "history",        element: <HistoryList /> },
      { path: "history/:id",    element: <HistoryDetails /> },
    ]
  },
]);


export default function Router () {
  return <RouterProvider router={router} />
}
