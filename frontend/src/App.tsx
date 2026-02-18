import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { HeartPulse } from 'lucide-react'
import BrandLogo from './components/BrandLogo'
import IpList from './pages/IpList'
import IpDetail from './pages/IpDetail'
import DataHealthPage from './pages/DataHealthPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-brew-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/ips" className="flex items-center gap-2 hover:text-brew-100 transition-colors">
            <BrandLogo size="md" />
            <span className="text-xl font-bold tracking-tight">Brew Signal</span>
          </Link>
          <div className="text-brew-200 text-sm hidden sm:block">
            IP Licensing Decisions
          </div>
          <Link to="/admin/data-health" className="ml-auto flex items-center gap-1.5 text-brew-200 hover:text-white text-xs transition-colors">
            <HeartPulse className="w-3.5 h-3.5" />
            Data Health
          </Link>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/ips" element={<IpList />} />
          <Route path="/ips/:id" element={<IpDetail />} />
          <Route path="/admin/data-health" element={<DataHealthPage />} />
          <Route path="*" element={<Navigate to="/ips" replace />} />
        </Routes>
      </main>
      <footer className="border-t border-stone-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-2 text-xs text-stone-400">
          <BrandLogo size="sm" className="text-stone-300" />
          <span>Brew Signal &middot; 5min Coffee &middot; IP licensing decisions for FamilyMart drip coffee collaborations</span>
        </div>
      </footer>
    </div>
  )
}
