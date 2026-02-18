import { Routes, Route, Navigate, Link } from 'react-router-dom'
import IpList from './pages/IpList'
import IpDetail from './pages/IpDetail'
import DataHealthPage from './pages/DataHealthPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-brew-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/ips" className="text-xl font-bold tracking-tight hover:text-brew-100 transition-colors">Brew Signal</Link>
          <div className="text-brew-200 text-sm hidden sm:block">
            IP Timing Dashboard &middot; 5min Coffee
          </div>
          <Link to="/admin/data-health" className="ml-auto text-brew-200 hover:text-white text-xs transition-colors">
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
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-stone-400">
          This dashboard supports 5min Coffee BD decisions for FamilyMart channel drip coffee collaborations.
          Goal: decide whether to start licensing negotiation now (12-week lead), not to predict whether an IP will be popular.
        </div>
      </footer>
    </div>
  )
}
