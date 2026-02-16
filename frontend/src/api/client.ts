import axios from 'axios'
import type {
  IPItem, IPDetail, TrendResponse, HealthData, SignalsData, CollectResult, Alias,
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

// Trend
export const getTrend = (ipId: string, geo: string, timeframe: string, mode: string = 'composite') =>
  api.get<TrendResponse>(`/ip/${ipId}/trend`, { params: { geo, timeframe, mode } }).then(r => r.data)

// Health
export const getHealth = (ipId: string, geo: string, timeframe: string) =>
  api.get<HealthData>(`/ip/${ipId}/health`, { params: { geo, timeframe } }).then(r => r.data)

// Signals
export const getSignals = (ipId: string, geo: string, timeframe: string) =>
  api.get<SignalsData>(`/ip/${ipId}/signals`, { params: { geo, timeframe } }).then(r => r.data)

// Collect
export const runCollect = (ipId: string, geo: string, timeframe: string) =>
  api.post<CollectResult>('/collect/run', { ip_id: ipId, geo, timeframe }).then(r => r.data)
