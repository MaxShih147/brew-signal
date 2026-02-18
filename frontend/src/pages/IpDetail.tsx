import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Play, Loader2, RefreshCw } from 'lucide-react'
import { getIP, getTrend, getHealth, getSignals, getBDScore, updateOpportunityInputs, listEvents, runCollect, malSync, youtubeSync, deleteIP } from '../api/client'
import type { IPDetail as IPDetailType, DailyTrendPoint, TrendPointRaw, HealthData, SignalsData, BDScoreData, IndicatorResult, IPEvent } from '../types'
import IpConfigCard from '../components/IpConfigCard'
import HealthCard from '../components/HealthCard'
import TrendChart from '../components/TrendChart'
import BDScoreCard from '../components/BDScoreCard'
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
  const [bdScore, setBDScore] = useState<BDScoreData | null>(null)
  const [events, setEvents] = useState<IPEvent[]>([])

  const [loadingIP, setLoadingIP] = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [loadingSignals, setLoadingSignals] = useState(true)
  const [loadingBD, setLoadingBD] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMsg, setCollectMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncingYT, setSyncingYT] = useState(false)

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
    setLoadingBD(true)

    const [composite, byAlias, healthData, signalData, bdData, eventsData] = await Promise.allSettled([
      getTrend(id, geo, timeframe, 'composite'),
      getTrend(id, geo, timeframe, 'by_alias'),
      getHealth(id, geo, timeframe),
      getSignals(id, geo, timeframe),
      getBDScore(id, geo, timeframe),
      listEvents(id),
    ])

    if (composite.status === 'fulfilled') setCompositeData(composite.value.points as DailyTrendPoint[])
    if (byAlias.status === 'fulfilled') setByAliasData(byAlias.value.points as TrendPointRaw[])
    if (healthData.status === 'fulfilled') setHealth(healthData.value)
    if (signalData.status === 'fulfilled') setSignals(signalData.value)
    if (bdData.status === 'fulfilled') setBDScore(bdData.value)
    if (eventsData.status === 'fulfilled') setEvents(eventsData.value)

    setLoadingTrend(false)
    setLoadingHealth(false)
    setLoadingSignals(false)
    setLoadingBD(false)
  }, [id, geo, timeframe])

  useEffect(() => { loadIP() }, [loadIP])
  useEffect(() => { loadData() }, [loadData])

  // BD Score formula (mirrors backend bd_allocation_service.py)
  const recomputeBDScore = (indicators: IndicatorResult[]) => {
    const byDim: Record<string, number[]> = {}
    for (const ind of indicators) {
      if (!byDim[ind.dimension]) byDim[ind.dimension] = []
      byDim[ind.dimension].push(ind.score_0_100)
    }
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 50

    const demand = avg(byDim['demand'] || [50])
    const supply = avg(byDim['supply'] || [50])
    const diffusion = avg(byDim['diffusion'] || [50])
    const rightsholder = indicators.find(i => i.key === 'rightsholder_intensity')?.score_0_100 ?? 50
    const timingRaw = indicators.find(i => i.key === 'timing_window')?.score_0_100 ?? 50

    // Fit gate
    const adultFit = indicators.find(i => i.key === 'adult_fit')?.score_0_100 ?? 50
    const giftability = indicators.find(i => i.key === 'giftability')?.score_0_100 ?? 50
    const brandAesthetic = indicators.find(i => i.key === 'brand_aesthetic')?.score_0_100 ?? 50
    const fitGateScore = Math.min(adultFit, giftability, brandAesthetic)
    const fitGatePassed = fitGateScore >= 30

    // Timing urgency
    const timingUrgency = Math.max(0, Math.min(100,
      timingRaw * (1 + 0.3 * rightsholder / 100)
    ))

    // Demand trajectory
    const searchMom = indicators.find(i => i.key === 'search_momentum')
    const accelBonus = (searchMom?.raw?.acceleration) ? 10 : 0
    const demandTrajectory = Math.max(0, Math.min(100, demand + accelBonus))

    // Market gap
    const marketGap = 100 - supply

    // Feasibility
    const feasibility = Math.max(0, Math.min(100,
      0.5 * diffusion + 0.5 * (100 - rightsholder)
    ))

    // Raw score
    const rawScore = 0.35 * timingUrgency + 0.30 * demandTrajectory + 0.20 * marketGap + 0.15 * feasibility

    // Confidence multiplier (use existing)
    const confMult = bdScore?.confidence_multiplier ?? 0.5
    const score = Math.max(0, Math.min(100, rawScore * confMult))

    // Decision
    let decision: 'START' | 'MONITOR' | 'REJECT'
    if (!fitGatePassed) decision = 'REJECT'
    else if (score >= 70) decision = 'START'
    else if (score >= 40) decision = 'MONITOR'
    else decision = 'REJECT'

    return {
      score, decision, fitGateScore, fitGatePassed,
      timingUrgency, demandTrajectory, marketGap, feasibility,
      rawScore, confMult,
    }
  }

  const handleSliderChange = (key: string, value: number) => {
    if (!id || !bdScore) return

    const updated = bdScore.indicators.map(ind => {
      const matchKey = ind.key === 'timing_window' ? 'timing_window_override' : ind.key
      if (matchKey === key) {
        return { ...ind, score_0_100: value * 100, status: 'MANUAL' as const }
      }
      return ind
    })

    const r = recomputeBDScore(updated)
    setBDScore({
      ...bdScore,
      indicators: updated,
      bd_score: r.score,
      bd_decision: r.decision,
      fit_gate_score: r.fitGateScore,
      fit_gate_passed: r.fitGatePassed,
      timing_urgency: r.timingUrgency,
      demand_trajectory: r.demandTrajectory,
      market_gap: r.marketGap,
      feasibility: r.feasibility,
      raw_score: r.rawScore,
      confidence_multiplier: r.confMult,
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

  const handleMalSync = async () => {
    if (!id) return
    setSyncing(true)
    setCollectMsg(null)
    try {
      const result = await malSync(id)
      const parts = [
        result.matched ? `Matched (mal_id=${result.mal_id})` : 'No match',
        `${result.events_added} events added`,
        result.events_skipped ? `${result.events_skipped} skipped` : '',
      ].filter(Boolean)
      setCollectMsg(`MAL sync: ${parts.join(', ')}`)
      loadData()
    } catch (err: any) {
      setCollectMsg(`MAL sync error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleYoutubeSync = async () => {
    if (!id) return
    setSyncingYT(true)
    setCollectMsg(null)
    try {
      const result = await youtubeSync(id)
      const parts = [
        `${result.videos_added} videos synced`,
        result.errors.length ? result.errors[0] : '',
      ].filter(Boolean)
      setCollectMsg(`YouTube sync: ${parts.join(', ')}`)
      loadData()
    } catch (err: any) {
      setCollectMsg(`YouTube sync error: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSyncingYT(false)
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
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleMalSync}
            disabled={syncing}
            className="px-4 py-2 bg-white border border-brew-300 text-brew-700 text-sm font-medium rounded-xl hover:bg-brew-50 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Syncing...' : 'Sync MAL'}
          </button>
          <button
            onClick={handleYoutubeSync}
            disabled={syncingYT}
            className="px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-xl hover:bg-red-50 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {syncingYT ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {syncingYT ? 'Syncing...' : 'Sync YouTube'}
          </button>
          <button
            onClick={handleCollect}
            disabled={collecting}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {collecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {collecting ? 'Collecting...' : 'Run Collection'}
          </button>
        </div>
      </div>

      {collectMsg && (
        <div className={`mb-4 p-3 rounded-xl text-sm border ${
          collectMsg.startsWith('success') || collectMsg.startsWith('MAL sync: Matched') || collectMsg.startsWith('YouTube sync:')
            ? 'bg-emerald-50/70 text-emerald-700 border-emerald-200'
            : 'bg-amber-50/70 text-amber-700 border-amber-200'
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
          <BDScoreCard data={bdScore} loading={loadingBD} />
          <OpportunityMetricGrid
            indicators={bdScore?.indicators || []}
            onSliderChange={handleSliderChange}
          />
          <AlertsPanel alerts={signals?.alerts || []} />
        </div>
      </div>
    </div>
  )
}
