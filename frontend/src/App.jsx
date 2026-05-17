import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useSubjectType } from './pages/learn/SubjectContext'
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
import LearnLayout from './pages/learn/LearnLayout'
import Dashboard from './pages/learn/Dashboard'
import AreaList from './pages/learn/AreaList'
import AreaDetail from './pages/learn/AreaDetail'
import Traps from './pages/learn/Traps'
import Grammar from './pages/learn/Grammar'
import ExamMapping from './pages/learn/ExamMapping'
import Priority from './pages/learn/Priority'
import Checklist from './pages/learn/Checklist'
import Bookmarks from './pages/learn/Bookmarks'
import EnDashboard from './pages/learn/en/EnDashboard'
import EnVocabulary from './pages/learn/en/EnVocabulary'
import EnGrammarPatterns from './pages/learn/en/EnGrammarPatterns'
import EnIdioms from './pages/learn/en/EnIdioms'
import EnBusiness from './pages/learn/en/EnBusiness'
import EnTimeStrategy from './pages/learn/en/EnTimeStrategy'
import './index.css'

function QuizWithKey() {
  const location = useLocation()
  return <Quiz key={location.search} />
}

function SmartDashboard() {
  const type = useSubjectType()
  return type === "english" ? <EnDashboard /> : <Dashboard />
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
        <Route path="learn" element={<LearnLayout />}>
          <Route index element={<SmartDashboard />} />
          <Route path="areas" element={<AreaList />} />
          <Route path="areas/:areaKey" element={<AreaDetail />} />
          <Route path="traps" element={<Traps />} />
          <Route path="grammar" element={<Grammar />} />
          <Route path="exam-mapping" element={<ExamMapping />} />
          <Route path="priority" element={<Priority />} />
          <Route path="checklist" element={<Checklist />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="en/vocabulary" element={<EnVocabulary />} />
          <Route path="en/grammar" element={<EnGrammarPatterns />} />
          <Route path="en/idioms" element={<EnIdioms />} />
          <Route path="en/business" element={<EnBusiness />} />
          <Route path="en/time-strategy" element={<EnTimeStrategy />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
