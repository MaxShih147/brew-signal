import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { HeartPulse, LayoutGrid } from 'lucide-react'
import BrandLogo from './components/BrandLogo'
import IpList from './pages/IpList'
import IpDetail from './pages/IpDetail'
import DataHealthPage from './pages/DataHealthPage'

export default function App() {
  const location = useLocation()
  const isHealth = location.pathname.startsWith('/admin')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-r from-brew-800 via-brew-700 to-brew-800 text-white shadow-lg shadow-brew-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <Link to="/ips" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <BrandLogo size="md" />
            <span className="text-lg font-bold tracking-tight">Brew Signal</span>
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            <Link
              to="/ips"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                !isHealth ? 'bg-white/15 text-white' : 'text-brew-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              IPs
            </Link>
            <Link
              to="/admin/data-health"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isHealth ? 'bg-white/15 text-white' : 'text-brew-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5" />
              Health
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Routes>
          <Route path="/ips" element={<IpList />} />
          <Route path="/ips/:id" element={<IpDetail />} />
          <Route path="/admin/data-health" element={<DataHealthPage />} />
          <Route path="*" element={<Navigate to="/ips" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-brew-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-2 text-xs text-stone-400">
          <BrandLogo size="sm" className="text-brew-300" />
          <span>Brew Signal &middot; 5min Coffee &middot; IP licensing decisions for FamilyMart drip coffee</span>
        </div>
      </footer>
    </div>
  )
}
