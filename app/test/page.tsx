'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase, MessageQueue } from '@/lib/supabase'

const WEBHOOK = process.env.NEXT_PUBLIC_N8N_WEBHOOK!

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  processing: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-green-500/20 text-green-300',
  failed: 'bg-red-500/20 text-red-300',
}

type ChatMessage = {
  id: string
  role: 'user' | 'ai'
  text: string
  timestamp: Date
  responseTime?: number
  status?: string
}

function uuid() {
  return crypto.randomUUID()
}

export default function TestPage() {
  const [name, setName] = useState('')
  const [session, setSession] = useState<{ contactId: string; name: string } | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [queueRows, setQueueRows] = useState<MessageQueue[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const pollQueue = useCallback(async (contactId: string, msgId: string, sentAt: number) => {
    const { data } = await supabase
      .from('message_queue')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setQueueRows(data)
      const completed = data.find(r => r.status === 'completed' && r.ai_response)
      if (completed) {
        const responseTime = Math.round((Date.now() - sentAt) / 1000)
        setMessages(prev => [
          ...prev,
          {
            id: uuid(),
            role: 'ai',
            text: completed.ai_response!,
            timestamp: new Date(),
            responseTime,
          }
        ])
        if (pollRef.current) clearInterval(pollRef.current)
        setSending(false)
      }
    }
  }, [])

  const sendMessage = useCallback(async (text: string, contactId: string, contactName: string) => {
    const sentAt = Date.now()
    const msgId = uuid()

    setMessages(prev => [...prev, {
      id: msgId, role: 'user', text, timestamp: new Date()
    }])

    // Fire and forget to webhook
    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId,
        full_name: contactName,
        message: { body: text }
      })
    }).catch(() => {})

    // Poll for response
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => pollQueue(contactId, msgId, sentAt), 2000)

    // Stop polling after 60s
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current)
      setSending(false)
    }, 60000)
  }, [pollQueue])

  const handleSend = async () => {
    if (!session || !input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    await sendMessage(text, session.contactId, session.name)
  }

  const handleStressTest = async () => {
    if (!session || sending) return
    setSending(true)
    const stressMessages = ['Hola', 'Quiero info sobre rinoplastia', '¿Cuánto cuesta?']
    for (const msg of stressMessages) {
      await sendMessage(msg, session.contactId, session.name)
      await new Promise(r => setTimeout(r, 200))
    }
  }

  const startSession = () => {
    if (!name.trim()) return
    setSession({ contactId: uuid(), name: name.trim() })
    setMessages([])
    setQueueRows([])
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">🧪 Test AI Agent</h1>

      {/* Session Setup */}
      {!session ? (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 max-w-md">
          <h2 className="font-semibold mb-4">Iniciar sesión de prueba</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startSession()}
              placeholder="Tu nombre..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={startSession}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Iniciar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Chat */}
          <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 flex flex-col" style={{ height: '520px' }}>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <div className="font-semibold">{session.name}</div>
                <div className="text-xs text-gray-400 font-mono">{session.contactId.slice(0, 16)}...</div>
              </div>
              <button
                onClick={() => { setSession(null); setMessages([]); setQueueRows([]) }}
                className="text-xs text-gray-400 hover:text-white"
              >
                Nueva sesión
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-gray-500 text-sm mt-8">
                  Envía un mensaje para empezar
                </p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-700 text-gray-100 rounded-bl-sm'}`}>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div className={`text-[10px] mt-1 flex items-center gap-1 ${m.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {m.timestamp.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                      {m.responseTime && <span>• ⚡{m.responseTime}s</span>}
                    </div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-800 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Escribe un mensaje..."
                disabled={sending}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <button
                onClick={handleStressTest}
                disabled={sending}
                title="Envía 3 mensajes rápido para probar la cola"
                className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white px-3 py-2 rounded-xl text-xs font-medium transition-colors"
              >
                ⚡x3
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>

          {/* Queue Status Panel */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
            <h3 className="font-semibold text-sm text-gray-300">Queue Status</h3>
            <p className="text-xs text-gray-500">Mensajes de este contacto en Supabase</p>
            {queueRows.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Sin datos aún</p>
            ) : (
              <div className="space-y-2">
                {queueRows.map(r => (
                  <div key={r.id} className="bg-gray-800 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                        {r.status}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(r.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 truncate">{r.message}</p>
                    {r.processed_at && (
                      <p className="text-[10px] text-gray-500">
                        ⚡ {Math.round((new Date(r.processed_at).getTime() - new Date(r.created_at).getTime()) / 1000)}s
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {session && (
              <button
                onClick={() => supabase.from('message_queue').select('*').eq('contact_id', session.contactId).order('created_at', { ascending: false }).limit(5).then(({ data }) => setQueueRows(data || []))}
                className="w-full text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg py-1.5 transition-colors"
              >
                🔄 Refrescar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
