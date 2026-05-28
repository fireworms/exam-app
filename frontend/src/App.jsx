import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import WrongNotes from './pages/WrongNotes'
import Scraps from './pages/Scraps'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import EditQuestion from './pages/EditQuestion'
import Stats from './pages/Stats'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import { supabase } from './supabase'
import './index.css'

function QuizWithKey() {
  const location = useLocation()
  return <Quiz key={location.search} />
}

function PrivateRoute({ children }) {
  // Supabase가 localStorage에 세션을 저장하므로 동기적으로 확인 가능
  const stored = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  return stored ? children : <Navigate to="/login" replace />
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
          <Route path="admin" element={<Admin />} />
          <Route path="upload" element={<Navigate to="/admin" replace />} />
          <Route path="logs" element={<Navigate to="/admin" replace />} />
          <Route path="edit/:question_id" element={<EditQuestion />} />
          <Route path="stats" element={<Stats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
