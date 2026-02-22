'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  'Kan ik volgende maand op vakantie?',
  'Waar geef ik te veel aan uit?',
  'Hoeveel kan ik extra sparen?',
  'Hoe ziet mijn budget eruit?',
]

export default function ChatCoach() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMessage: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const data = await response.json()
      if (data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Chat met Fynn</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Stel elke financiële vraag</p>
      </div>

      <div className="px-5 py-4 min-h-[180px] max-h-[380px] overflow-y-auto">
        {messages.length === 0 ? (
          <div>
            <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Waar kan ik je mee helpen?</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-2 rounded-lg transition-colors"
                  style={{ 
                    backgroundColor: 'var(--tab-bg)', 
                    color: 'var(--muted)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={msg.role === 'user'
                    ? { backgroundColor: 'var(--brand)', color: '#FFFFFF', borderRadius: '16px 16px 4px 16px' }
                    : { backgroundColor: 'var(--tab-bg)', color: 'var(--text)', borderRadius: '16px 16px 16px 4px' }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl" style={{ backgroundColor: 'var(--tab-bg)' }}>
                  <div className="flex gap-1 items-center h-4">
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--muted)', animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--muted)', animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: 'var(--muted)', animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Stel een vraag..."
            className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
            style={{ 
              backgroundColor: 'var(--tab-bg)', 
              color: 'var(--text)',
              border: '1px solid var(--border)'
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-3 rounded-xl text-sm font-medium disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--brand)', color: '#FFFFFF' }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}