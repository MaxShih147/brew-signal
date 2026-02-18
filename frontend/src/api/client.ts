import axios from 'axios'
import type {
  IPItem, IPDetail, TrendResponse, HealthData, SignalsData, CollectResult, Alias, DiscoverAliasesResponse,
  OpportunityData, IPEvent, SourceHealthData, SourceRegistryData, SourceRunData, CoverageMatrixRow,
  BDScoreData, IPPipelineData, MALSyncResult, YouTubeSyncResult,
} from '../types'

const api = axios.create({
  baseURL: '/api',
})

// IP CRUD
export const listIPs = () => api.get<IPItem[]>('/ip').then(r => r.data)

export const getIP = (id: string) => api.get<IPDetail>(`/ip/${id}`).then(r => r.data)

export const createIP = (name: string, aliases: { alias: string; locale: string; weight: number }[]) =>
  api.post<IPDetail>('/ip', { name, aliases }).then(r => r.data)

export const updateIP = (id: string, name: string) =>
  api.put<IPDetail>(`/ip/${id}`, { name }).then(r => r.data)

export const addAlias = (ipId: string, body: { alias: string; locale: string; weight: number }) =>
  api.post<Alias>(`/ip/${ipId}/aliases`, body).then(r => r.data)

export const updateAlias = (aliasId: string, body: Partial<Alias>) =>
  api.put<Alias>(`/ip/alias/${aliasId}`, body).then(r => r.data)

export const deleteIP = (id: string) => api.delete(`/ip/${id}`)

export const deleteAlias = (aliasId: string) => api.delete(`/ip/alias/${aliasId}`)

export const resetAliasWeight = (aliasId: string) =>
  api.post<Alias>(`/ip/alias/${aliasId}/reset-weight`).then(r => r.data)

// Trend
export const getTrend = (ipId: string, geo: string, timeframe: string, mode: string = 'composite') =>
  api.get<TrendResponse>(`/ip/${ipId}/trend`, { params: { geo, timeframe, mode } }).then(r => r.data)

// Health
export const getHealth = (ipId: string, geo: string, timeframe: string) =>
  api.get<HealthData>(`/ip/${ipId}/health`, { params: { geo, timeframe } }).then(r => r.data)

// Signals
export const getSignals = (ipId: string, geo: string, timeframe: string) =>
  api.get<SignalsData>(`/ip/${ipId}/signals`, { params: { geo, timeframe } }).then(r => r.data)

// Discover aliases (AI)
export const discoverAliases = (ipId: string, autoAdd: boolean = true) =>
  api.post<DiscoverAliasesResponse>(`/ip/${ipId}/discover-aliases?auto_add=${autoAdd}`, {}).then(r => r.data)

// Events
export const listEvents = (ipId: string) =>
  api.get<IPEvent[]>(`/ip/${ipId}/events`).then(r => r.data)

export const createEvent = (ipId: string, body: { event_type: string; title: string; event_date: string; source?: string }) =>
  api.post<IPEvent>(`/ip/${ipId}/events`, body).then(r => r.data)

export const deleteEvent = (eventId: string) =>
  api.delete(`/ip/event/${eventId}`)

// Opportunity
export const getOpportunity = (ipId: string, geo: string, timeframe: string) =>
  api.get<OpportunityData>(`/ip/${ipId}/opportunity`, { params: { geo, timeframe } }).then(r => r.data)

export const updateOpportunityInputs = (ipId: string, inputs: Record<string, number>) =>
  api.put(`/ip/${ipId}/opportunity`, { inputs }).then(r => r.data)

// BD Allocation
export const getBDScore = (ipId: string, geo: string, timeframe: string) =>
  api.get<BDScoreData>(`/ip/${ipId}/bd-score`, { params: { geo, timeframe } }).then(r => r.data)

export const getBDRanking = (geo: string, timeframe: string) =>
  api.get<BDScoreData[]>('/ip/bd-ranking', { params: { geo, timeframe } }).then(r => r.data)

// Pipeline
export const getPipeline = (ipId: string) =>
  api.get<IPPipelineData>(`/ip/${ipId}/pipeline`).then(r => r.data)

export const createPipeline = (ipId: string, body: { stage?: string; target_launch_date?: string; mg_amount_usd?: number; notes?: string }) =>
  api.post<IPPipelineData>(`/ip/${ipId}/pipeline`, body).then(r => r.data)

export const updatePipeline = (ipId: string, body: Partial<IPPipelineData>) =>
  api.put<IPPipelineData>(`/ip/${ipId}/pipeline`, body).then(r => r.data)

// Collect
export const runCollect = (ipId: string, geo: string, timeframe: string) =>
  api.post<CollectResult>('/collect/run', { ip_id: ipId, geo, timeframe }).then(r => r.data)

// MAL Sync
export const malSync = (ipId: string) =>
  api.post<MALSyncResult>(`/collect/mal-sync/${ipId}`).then(r => r.data)

// YouTube Sync
export const youtubeSync = (ipId: string) =>
  api.post<YouTubeSyncResult>(`/collect/youtube-sync/${ipId}`).then(r => r.data)

// Admin: Data Health
export const getSourceHealth = () =>
  api.get<SourceHealthData[]>('/admin/data-health/sources').then(r => r.data)

export const getSourceRegistry = () =>
  api.get<SourceRegistryData[]>('/admin/data-health/registry').then(r => r.data)

export const getCoverageMatrix = (limit: number = 50, onlyIssues: boolean = false) =>
  api.get<CoverageMatrixRow[]>('/admin/data-health/matrix', { params: { limit, only_issues: onlyIssues } }).then(r => r.data)

export const getSourceRuns = (sourceKey?: string, limit: number = 50) =>
  api.get<SourceRunData[]>('/admin/data-health/runs', { params: { source_key: sourceKey, limit } }).then(r => r.data)
