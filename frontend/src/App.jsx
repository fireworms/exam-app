import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import WrongNotes from './pages/WrongNotes'
import Scraps from './pages/Scraps'
import Settings from './pages/Settings'
import UploadPage from "./pages/UploadPage";
import LogsPage from "./pages/LogsPage";
import EditQuestion from './pages/EditQuestion'
import Stats from './pages/Stats'
import './index.css'

function QuizWithKey() {
  const location = useLocation()
  return <Quiz key={location.search} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="quiz" element={<QuizWithKey />} />
          <Route path="wrong-notes" element={<WrongNotes />} />
          <Route path="scraps" element={<Scraps />} />
          <Route path="settings" element={<Settings />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="edit/:question_id" element={<EditQuestion />} />
          <Route path="stats" element={<Stats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
