import { createBrowserRouter, RouterProvider } from "react-router-dom"

import App from '../App'

import Home from '../pages/Home'
import Login from '../pages/Login'
import Questions from '../pages/Questions'
import PreVitals from '../pages/PreVitals'
import VitalsResult from '../pages/VitalsResult'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />
      },
      {
        path: "/login",
        element: <Login />
      },
      {
        path: "/questions",
        element: <Questions />
      },
      {
        path: "/pre-vitals",
        element: <PreVitals />
      },
      {
        path: "/vitals-result",
        element: <VitalsResult />
      },
    ]
  },
]);


export default function Router () {
  return <RouterProvider router={router} />
}