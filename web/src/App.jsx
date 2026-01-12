import { Routes, Route } from 'react-router-dom'
import { AuthContextProvider } from './context/AuthContext'
import { Nav } from './components/Nav'
import HomePage from './app/page.jsx'
import LoginPage from './app/login/page.jsx'
import RegisterPage from './app/register/page.jsx'
import DashboardPage from './app/dashboard/page.jsx'
import SearchPage from './app/search/page.jsx'
import MediaPage from './app/media/page.jsx'

function App() {
  return (
    <AuthContextProvider>
      <Nav />
      <div style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/media/:id" element={<MediaPage />} />
        </Routes>
      </div>
    </AuthContextProvider>
  )
}

export default App
