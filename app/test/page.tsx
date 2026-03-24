'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase, MessageQueue } from '@/lib/supabase'

const WEBHOOK = process.env.NEXT_PUBLIC_N8N_WEBHOOK || ''

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  text: string
  timestamp: Date
  responseTime?: number
}

function uuid() { return crypto.randomUUID() }

export default function TestPage() {
  const [name, setName] = useState('')
  const [session, setSession] = useState<{ contactId: string; name: string } | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [queueRows, setQueueRows] = useState<MessageQueue[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const lastProcessedRef = useRef<string | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const refreshQueue = useCallback(async (contactId: string) => {
    const { data } = await supabase
      .from('message_queue')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setQueueRows(data)
    return data || []
  }, [])

  const pollQueue = useCallback(async (contactId: string, sentAt: number) => {
    const data = await refreshQueue(contactId)
    const completed = data.find(r =>
      r.status === 'completed' && r.ai_response && r.id !== lastProcessedRef.current
    )
    if (completed) {
      lastProcessedRef.current = completed.id
      const responseTime = Math.round((Date.now() - sentAt) / 1000)
      setMessages(prev => [...prev, {
        id: uuid(), role: 'ai', text: completed.ai_response!, timestamp: new Date(), responseTime
      }])
      if (pollRef.current) clearInterval(pollRef.current)
      setSending(false)
    }
  }, [refreshQueue])

  const sendMessage = useCallback(async (text: string, contactId: string, contactName: string) => {
    const sentAt = Date.now()
    setMessages(prev => [...prev, { id: uuid(), role: 'user', text, timestamp: new Date() }])

    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId,
        first_name: contactName.split(' ')[0],
        last_name: contactName.split(' ').slice(1).join(' ') || '',
        full_name: contactName,
        phone: '', email: '', contact_type: 'lead',
        message: { type: 19, body: text },
        triggerData: {}, customData: {}
      })
    }).catch(() => {})

    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => pollQueue(contactId, sentAt), 2000)
    // Auto-reset after 90s max to avoid stuck state
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current)
      setSending(false)
    }, 90000)
  }, [pollQueue])

  const handleSend = async () => {
    if (!session || !input.trim()) return
    const text = input.trim()
    setInput('')
    setSending(true)
    await sendMessage(text, session.contactId, session.name)
  }

  const [rapidMsgs, setRapidMsgs] = useState(['', '', ''])
  const [showRapid, setShowRapid] = useState(false)

  const handleRapidFire = async () => {
    if (!session) return
    const msgs = rapidMsgs.filter(m => m.trim())
    if (msgs.length === 0) return
    setShowRapid(false)
    setRapidMsgs(['', '', ''])
    setSending(true)
    for (const msg of msgs) {
      await sendMessage(msg.trim(), session.contactId, session.name)
      await new Promise(r => setTimeout(r, 250))
    }
  }

  const startSession = () => {
    if (!name.trim()) return
    setSession({ contactId: uuid(), name: name.trim() })
    setMessages([]); setQueueRows([])
    lastProcessedRef.current = null
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">🧪 Test AI Agent</h1>

      {!session ? (
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm max-w-md">
          <h2 className="font-semibold text-gray-800 mb-1">Iniciar sesión de prueba</h2>
          <p className="text-sm text-gray-500 mb-4">Escribe un nombre para generar un contacto de prueba</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startSession()}
              placeholder="Tu nombre..."
              className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button onClick={startSession} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              Iniciar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Chat */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col" style={{ height: '540px' }}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-xl">
              <div>
                <div className="font-semibold text-gray-900">{session.name}</div>
                <div className="text-xs text-gray-400 font-mono">{session.contactId.slice(0, 20)}...</div>
              </div>
              <button onClick={() => { setSession(null); setMessages([]); setQueueRows([]) }}
                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1 transition-colors">
                Nueva sesión
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-12">Envía un mensaje para comenzar</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'}`}>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div className={`text-[10px] mt-1 flex items-center gap-1 ${m.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {m.timestamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      {m.responseTime && <span>· ⚡{m.responseTime}s</span>}
                    </div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                    <div className="flex gap-1 items-center">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {showRapid && (
              <div className="px-3 pt-3 pb-2 border-t border-amber-100 bg-amber-50 space-y-2">
                <p className="text-xs font-medium text-amber-700">⚡ Ráfaga — escribe 3 mensajes distintos y se mandan con 250ms de diferencia:</p>
                {rapidMsgs.map((m, i) => (
                  <input key={i} type="text" value={m}
                    onChange={e => setRapidMsgs(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={['Ej: Hola buenas tardes', 'Ej: Quiero info sobre rinoplastia', 'Ej: ¿Cuánto cuesta la consulta?'][i]}
                    className="w-full bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-400"
                  />
                ))}
                <button onClick={handleRapidFire} disabled={rapidMsgs.every(m => !m.trim())}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white py-1.5 rounded-lg text-sm font-medium transition-colors">
                  🚀 Enviar en ráfaga
                </button>
              </div>
            )}
            <div className="p-3 border-t border-gray-100 flex gap-2 bg-white rounded-b-xl">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Escribe un mensaje..."
                disabled={sending}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-400"
              />
              <button onClick={() => setShowRapid(v => !v)}
                title="Envía 3 mensajes diferentes en ráfaga para probar la cola"
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${showRapid ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                ⚡ Ráfaga
              </button>
              <button onClick={handleSend} disabled={sending || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>

          {/* Queue Status */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-sm text-gray-800">Queue Status</h3>
              <p className="text-xs text-gray-400 mt-0.5">Mensajes en Supabase en tiempo real</p>
            </div>
            {queueRows.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-4 text-center">Sin datos aún — envía un mensaje</p>
            ) : (
              <div className="space-y-2">
                {queueRows.map(r => (
                  <div key={r.id} className="bg-gray-50 rounded-lg p-3 space-y-1 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(r.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 truncate">{r.message}</p>
                    {r.processed_at && (
                      <p className="text-[10px] text-gray-400">
                        ⚡ {Math.round((new Date(r.processed_at).getTime() - new Date(r.created_at).getTime()) / 1000)}s
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => session && refreshQueue(session.contactId)}
              className="w-full text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg py-1.5 transition-colors bg-gray-50 hover:bg-gray-100">
              🔄 Refrescar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
