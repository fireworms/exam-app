import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import WrongNotes from './pages/WrongNotes'
import Scraps from './pages/Scraps'
import Settings from './pages/Settings'
import UploadPage from "./pages/UploadPage"
import LogsPage from "./pages/LogsPage"
import EditQuestion from './pages/EditQuestion'
import Stats from './pages/Stats'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import { getToken } from './api'
import './index.css'

function QuizWithKey() {
  const location = useLocation()
  return <Quiz key={location.search} />
}

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Home />} />
          <Route path="quiz" element={<QuizWithKey />} />
          <Route path="wrong-notes" element={<WrongNotes />} />
          <Route path="scraps" element={<Scraps />} />
          <Route path="settings" element={<Settings />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="edit/:question_id" element={<EditQuestion />} />
          <Route path="stats" element={<Stats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
