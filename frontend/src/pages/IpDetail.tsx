import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getIP, getTrend, getHealth, getSignals, runCollect, deleteIP } from '../api/client'
import type { IPDetail as IPDetailType, DailyTrendPoint, TrendPointRaw, HealthData, SignalsData } from '../types'
import IpConfigCard from '../components/IpConfigCard'
import HealthCard from '../components/HealthCard'
import TrendChart from '../components/TrendChart'
import SignalsPanel from '../components/SignalsPanel'
import AlertsPanel from '../components/AlertsPanel'

export default function IpDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [ip, setIP] = useState<IPDetailType | null>(null)
  const [geo, setGeo] = useState('TW')
  const [timeframe, setTimeframe] = useState('12m')

  const [compositeData, setCompositeData] = useState<DailyTrendPoint[]>([])
  const [byAliasData, setByAliasData] = useState<TrendPointRaw[]>([])
  const [health, setHealth] = useState<HealthData | null>(null)
  const [signals, setSignals] = useState<SignalsData | null>(null)

  const [loadingIP, setLoadingIP] = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMsg, setCollectMsg] = useState<string | null>(null)

  const loadIP = useCallback(async () => {
    if (!id) return
    setLoadingIP(true)
    try {
      setIP(await getIP(id))
    } finally {
      setLoadingIP(false)
    }
  }, [id])

  const loadData = useCallback(async () => {
    if (!id) return

    setLoadingTrend(true)
    setLoadingHealth(true)
    setLoadingSignals(true)

    const [composite, byAlias, healthData, signalData] = await Promise.allSettled([
      getTrend(id, geo, timeframe, 'composite'),
      getTrend(id, geo, timeframe, 'by_alias'),
      getHealth(id, geo, timeframe),
      getSignals(id, geo, timeframe),
    ])

    if (composite.status === 'fulfilled') {
      setCompositeData(composite.value.points as DailyTrendPoint[])
    }
    if (byAlias.status === 'fulfilled') {
      setByAliasData(byAlias.value.points as TrendPointRaw[])
    }
    if (healthData.status === 'fulfilled') {
      setHealth(healthData.value)
    }
    if (signalData.status === 'fulfilled') {
      setSignals(signalData.value)
    }

    setLoadingTrend(false)
    setLoadingHealth(false)
    setLoadingSignals(false)
  }, [id, geo, timeframe])

  useEffect(() => { loadIP() }, [loadIP])
  useEffect(() => { loadData() }, [loadData])

  const handleCollect = async () => {
    if (!id) return
    setCollecting(true)
    setCollectMsg(null)
    try {
      const result = await runCollect(id, geo, timeframe)
      setCollectMsg(`${result.status}: ${result.message}${result.duration_ms ? ` (${result.duration_ms}ms)` : ''}`)
      // Reload data after collection
      loadData()
    } catch (err: any) {
      setCollectMsg(`Error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setCollecting(false)
    }
  }

  if (loadingIP) {
    return <div className="py-12 text-center text-stone-400">Loading...</div>
  }
  if (!ip) {
    return <div className="py-12 text-center text-stone-400">IP not found</div>
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ips" className="text-brew-600 hover:text-brew-700 text-sm">&larr; Back</Link>
        <h1 className="text-2xl font-bold text-stone-800">{ip.name}</h1>
        <button
          onClick={async () => {
            if (!id || !confirm(`Delete "${ip.name}" and all its data?`)) return
            await deleteIP(id)
            navigate('/ips')
          }}
          className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
          title="Delete IP"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="ml-auto px-4 py-2 bg-brew-600 text-white text-sm font-medium rounded-lg hover:bg-brew-700 disabled:opacity-50 transition-colors"
        >
          {collecting ? 'Collecting...' : 'Run Collection'}
        </button>
      </div>

      {collectMsg && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          collectMsg.startsWith('success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {collectMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: Config + Health */}
        <div className="space-y-5">
          <IpConfigCard
            ip={ip}
            geo={geo}
            timeframe={timeframe}
            onGeoChange={setGeo}
            onTimeframeChange={setTimeframe}
            onRefresh={loadIP}
          />
          <HealthCard health={health} loading={loadingHealth} />
        </div>

        {/* Right column: Chart + Signals + Alerts */}
        <div className="lg:col-span-2 space-y-5">
          <TrendChart
            compositeData={compositeData}
            byAliasData={byAliasData}
            loading={loadingTrend}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SignalsPanel signals={signals} loading={loadingSignals} />
            <AlertsPanel alerts={signals?.alerts || []} />
          </div>
        </div>
      </div>
    </div>
  )
}
