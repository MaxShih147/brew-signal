import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Play, Loader2 } from 'lucide-react'
import { getIP, getTrend, getHealth, getSignals, getOpportunity, updateOpportunityInputs, listEvents, runCollect, deleteIP } from '../api/client'
import type { IPDetail as IPDetailType, DailyTrendPoint, TrendPointRaw, HealthData, SignalsData, OpportunityData, IndicatorResult, IPEvent } from '../types'
import IpConfigCard from '../components/IpConfigCard'
import HealthCard from '../components/HealthCard'
import TrendChart from '../components/TrendChart'
import OpportunityScoreCard from '../components/OpportunityScoreCard'
import OpportunityMetricGrid from '../components/OpportunityMetricGrid'
import EventsCard from '../components/EventsCard'
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
  const [opportunity, setOpportunity] = useState<OpportunityData | null>(null)
  const [events, setEvents] = useState<IPEvent[]>([])

  const [loadingIP, setLoadingIP] = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [loadingOpportunity, setLoadingOpportunity] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMsg, setCollectMsg] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setLoadingOpportunity(true)

    const [composite, byAlias, healthData, signalData, oppData, eventsData] = await Promise.allSettled([
      getTrend(id, geo, timeframe, 'composite'),
      getTrend(id, geo, timeframe, 'by_alias'),
      getHealth(id, geo, timeframe),
      getSignals(id, geo, timeframe),
      getOpportunity(id, geo, timeframe),
      listEvents(id),
    ])

    if (composite.status === 'fulfilled') setCompositeData(composite.value.points as DailyTrendPoint[])
    if (byAlias.status === 'fulfilled') setByAliasData(byAlias.value.points as TrendPointRaw[])
    if (healthData.status === 'fulfilled') setHealth(healthData.value)
    if (signalData.status === 'fulfilled') setSignals(signalData.value)
    if (oppData.status === 'fulfilled') setOpportunity(oppData.value)
    if (eventsData.status === 'fulfilled') setEvents(eventsData.value)

    setLoadingTrend(false)
    setLoadingHealth(false)
    setLoadingSignals(false)
    setLoadingOpportunity(false)
  }, [id, geo, timeframe])

  useEffect(() => { loadIP() }, [loadIP])
  useEffect(() => { loadData() }, [loadData])

  const recomputeOpportunityScore = (indicators: IndicatorResult[]) => {
    const byDim: Record<string, number[]> = {}
    for (const ind of indicators) {
      if (!byDim[ind.dimension]) byDim[ind.dimension] = []
      byDim[ind.dimension].push(ind.score_0_100)
    }
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 50

    const demand = avg(byDim['demand'] || [50])
    const diffusion = avg(byDim['diffusion'] || [50])
    const fit = avg(byDim['fit'] || [50])
    const supply = avg(byDim['supply'] || [50])
    const rightsholder = indicators.find(i => i.key === 'rightsholder_intensity')?.score_0_100 ?? 50
    const timing = indicators.find(i => i.key === 'timing_window')?.score_0_100 ?? 50

    const base = 0.30 * demand + 0.20 * diffusion + 0.15 * fit
    const timingMult = 0.8 + 0.4 * (timing / 100)
    const riskMult = 1.0 / (1.0 + 0.25 * (supply / 100) + 0.10 * (rightsholder / 100))
    const score = Math.max(0, Math.min(100, base * timingMult * riskMult * 1.35))
    const light = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red'

    return { score, light, base, timingMult, riskMult, demand, diffusion, fit, supply, rightsholder, timing }
  }

  const handleSliderChange = (key: string, value: number) => {
    if (!id || !opportunity) return

    const updated = opportunity.indicators.map(ind => {
      const matchKey = ind.key === 'timing_window' ? 'timing_window_override' : ind.key
      if (matchKey === key) {
        return { ...ind, score_0_100: value * 100, status: 'MANUAL' as const }
      }
      return ind
    })

    const r = recomputeOpportunityScore(updated)
    setOpportunity({
      ...opportunity,
      indicators: updated,
      opportunity_score: r.score,
      opportunity_light: r.light,
      base_score: r.base,
      timing_multiplier: r.timingMult,
      risk_multiplier: r.riskMult,
      demand_score: r.demand,
      diffusion_score: r.diffusion,
      fit_score: r.fit,
      supply_risk: r.supply,
      gatekeeper_risk: r.rightsholder,
      timing_score: r.timing,
    })

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateOpportunityInputs(id, { [key]: value })
    }, 300)
  }

  const handleCollect = async () => {
    if (!id) return
    setCollecting(true)
    setCollectMsg(null)
    try {
      const result = await runCollect(id, geo, timeframe)
      setCollectMsg(`${result.status}: ${result.message}${result.duration_ms ? ` (${result.duration_ms}ms)` : ''}`)
      loadData()
    } catch (err: any) {
      setCollectMsg(`Error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setCollecting(false)
    }
  }

  if (loadingIP) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-stone-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    )
  }
  if (!ip) {
    return <div className="py-12 text-center text-stone-400">IP not found</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/ips" className="text-brew-600 hover:text-brew-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-brew-900">{ip.name}</h1>
        <button
          onClick={async () => {
            if (!id || !confirm(`Delete "${ip.name}" and all its data?`)) return
            await deleteIP(id)
            navigate('/ips')
          }}
          className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
          title="Delete IP"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleCollect}
          disabled={collecting}
          className="ml-auto btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {collecting ? 'Collecting...' : 'Run Collection'}
        </button>
      </div>

      {collectMsg && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${
          collectMsg.startsWith('success') ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200' : 'bg-amber-50/70 text-amber-700 border-amber-200'
        }`}>
          {collectMsg}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <IpConfigCard
            ip={ip}
            geo={geo}
            timeframe={timeframe}
            onGeoChange={setGeo}
            onTimeframeChange={setTimeframe}
            onRefresh={() => { loadIP(); loadData() }}
          />
          <HealthCard health={health} loading={loadingHealth} />
          {id && <EventsCard ipId={id} events={events} onUpdate={loadData} />}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <TrendChart
            compositeData={compositeData}
            byAliasData={byAliasData}
            loading={loadingTrend}
          />
          <OpportunityScoreCard data={opportunity} loading={loadingOpportunity} />
          <OpportunityMetricGrid
            indicators={opportunity?.indicators || []}
            onSliderChange={handleSliderChange}
          />
          <AlertsPanel alerts={signals?.alerts || []} />
        </div>
      </div>
    </div>
  )
}
