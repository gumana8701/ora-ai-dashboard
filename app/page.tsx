'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, MessageQueue, Chat } from '@/lib/supabase'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800 border border-yellow-200',
  processing: 'bg-blue-100 text-blue-800 border border-blue-200',
  completed:  'bg-green-100 text-green-800 border border-green-200',
  failed:     'bg-red-100 text-red-800 border border-red-200',
}

type N8nExecution = {
  id: number
  status: string
  startedAt: string
  stoppedAt?: string
  workflowId: string
}

function ConversationModal({ contactId, contactName, onClose }: { contactId: string; contactName: string; onClose: () => void }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('chats')
        .select('*')
        .eq('session_id', contactId)
        .order('created_at', { ascending: true })
      setChats(data || [])
      setLoading(false)
    }
    load()
  }, [contactId])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{contactName || 'Unknown'}</h3>
            <p className="text-xs text-gray-400 font-mono">{contactId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-8">Cargando...</p>
          ) : chats.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Sin historial de conversación</p>
          ) : chats.map((c) => {
            const isHuman = c.message?.type === 'human'
            const content = c.message?.content || ''
            return (
              <div key={c.id} className={`flex ${isHuman ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${isHuman ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'}`}>
                  {content}
                  <div className={`text-[10px] mt-1 ${isHuman ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {new Date(c.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [rows, setRows] = useState<MessageQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MessageQueue | null>(null)
  const [errors, setErrors] = useState<N8nExecution[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: queueData }, errorsData] = await Promise.all([
      supabase.from('message_queue').select('*').order('created_at', { ascending: false }).limit(500),
      fetch('https://n8n.daviddepablos.com/api/v1/executions?workflowId=ZFrGEnepFRlTi5hy&limit=50&status=error', {
        headers: { 'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMGFmMmZiZC02Y2NkLTQ3MzctYThlZS05MTkwYjUzMmFjODYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWIzNDA2MDItNjFmNS00MjJkLTkxYWEtOWRjMTM3MjJjMDU5IiwiaWF0IjoxNzc0Mjc3OTk1fQ.glLOJqVm59WZb3uU0cnx_3OXKRT8yDzqDkdHjjpUPlo' }
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }))
    ])
    setRows(queueData || [])
    setErrors(errorsData?.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().split('T')[0]

  // KPIs
  const uniqueContacts = new Set(rows.map(r => r.contact_id)).size
  const completedRows = rows.filter(r => r.status === 'completed')
  const todayMessages = rows.filter(r => r.created_at.startsWith(today)).length
  const completedWithTime = completedRows.filter(r => r.processed_at)
  const avgResponseSec = completedWithTime.length > 0
    ? Math.round(completedWithTime.reduce((acc, r) =>
        acc + (new Date(r.processed_at!).getTime() - new Date(r.created_at).getTime()) / 1000, 0) / completedWithTime.length)
    : 0

  const kpis = [
    { label: 'Contactos Únicos', value: uniqueContacts, icon: '👥', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Mensajes Completados', value: completedRows.length, icon: '✅', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Mensajes Hoy', value: todayMessages, icon: '📨', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Resp. Promedio', value: `${avgResponseSec}s`, icon: '⚡', color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  // Charts
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    messages: rows.filter(r => new Date(r.created_at).getHours() === i && r.created_at.startsWith(today)).length
  }))

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    return {
      day: d.toLocaleDateString('es', { weekday: 'short' }),
      messages: rows.filter(r => r.created_at.startsWith(dateStr)).length
    }
  })

  // Filtered rows
  const filtered = useMemo(() => rows.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      r.contact_id.toLowerCase().includes(q) ||
      (r.contact_name || '').toLowerCase().includes(q) ||
      (r.message || '').toLowerCase().includes(q)
    const matchStatus = !filterStatus || r.status === filterStatus
    const matchDate = !filterDate || r.created_at.startsWith(filterDate)
    return matchSearch && matchStatus && matchDate
  }), [rows, search, filterStatus, filterDate])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard WhatsApp AI Agent</h1>
          <p className="text-sm text-gray-500 mt-0.5">Satori IPS · [BETA] Agente WhatsApp 1era At.</p>
        </div>
        <button onClick={load} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors border border-gray-200 rounded-lg px-3 py-1.5">
          🔄 Actualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 ${k.bg} rounded-xl flex items-center justify-center text-xl mb-3`}>{k.icon}</div>
            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-sm text-gray-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Mensajes por hora (hoy)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#6b7280' }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="messages" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Mensajes últimos 7 días</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="messages" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* n8n Errors */}
      {errors.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-red-100 flex items-center justify-between bg-red-50">
            <h2 className="font-semibold text-red-800 flex items-center gap-2">
              <span>⚠️</span> Errores n8n recientes
              <span className="bg-red-200 text-red-800 text-xs px-2 py-0.5 rounded-full">{errors.length}</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-red-50 bg-red-50/50">
                  {['ID Ejecución', 'Inicio', 'Duración'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs text-red-700 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {errors.slice(0, 10).map(e => {
                  const duration = e.stoppedAt
                    ? Math.round((new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime()) / 1000) + 's'
                    : '—'
                  return (
                    <tr key={e.id} className="border-b border-red-50">
                      <td className="px-4 py-2 font-mono text-xs text-red-600">#{e.id}</td>
                      <td className="px-4 py-2 text-gray-600 text-xs">
                        {new Date(e.startedAt).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{duration}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Messages Table with filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-semibold text-gray-900 mr-auto">Mensajes</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{filtered.length} / {rows.length}</span>
          </div>
          {/* Filters */}
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar por nombre, ID o mensaje..."
              className="flex-1 min-w-[200px] border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 text-gray-900 placeholder-gray-400"
            />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-indigo-400 bg-white">
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="processing">Procesando</option>
              <option value="completed">Completado</option>
              <option value="failed">Error</option>
            </select>
            <input
              type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:border-indigo-400"
            />
            {(search || filterStatus || filterDate) && (
              <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterDate('') }}
                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-2 py-1.5">
                ✕ Limpiar
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Sin resultados para los filtros seleccionados</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Contacto', 'ID', 'Mensaje', 'Estado', 'Fecha', 'Tiempo'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(r => {
                  const respTime = r.processed_at
                    ? Math.round((new Date(r.processed_at).getTime() - new Date(r.created_at).getTime()) / 1000) + 's'
                    : '—'
                  return (
                    <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-gray-50 hover:bg-indigo-50/40 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.contact_name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{r.contact_id.slice(0, 10)}…</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.message}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] || STATUS_STYLES.pending}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('es', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{respTime}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ConversationModal
          contactId={selected.contact_id}
          contactName={selected.contact_name || 'Unknown'}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
