import { Routes, Route, Navigate } from 'react-router-dom'
import IpList from './pages/IpList'
import IpDetail from './pages/IpDetail'

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-brew-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-bold tracking-tight">Brew Signal</div>
          <div className="text-brew-200 text-sm hidden sm:block">
            IP Timing Dashboard &middot; 5min Coffee
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/ips" element={<IpList />} />
          <Route path="/ips/:id" element={<IpDetail />} />
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
