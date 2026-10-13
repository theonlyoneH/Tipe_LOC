import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, X } from 'lucide-react';
import { api } from '../lib/api';
import { describeError, errorReference } from '../lib/errors';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content: 'Hi! I am TIPE AI. Ask me about buyers, suppliers, markets or the latest trade news for your industry.',
};

export function ChatWidget({ hideOnMobile = false }: { hideOnMobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async () => {
    const query = input.trim();
    if (!query || busy) return;
    const history = messages.filter((m) => m !== GREETING);
    setMessages((m) => [...m, { role: 'user', content: query }]);
    setInput('');
    setBusy(true);
    try {
      const res = await api<{ response: string }>('/chat', { body: { query, history } });
      setMessages((m) => [...m, { role: 'assistant', content: res.response }]);
    } catch (e) {
      const f = describeError(e, "I couldn't answer that");
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${f.title}. ${f.message}\n(${errorReference(f)})` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-50 ${hideOnMobile && !open ? 'hidden lg:block' : ''}`}>
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.button
            key="fab"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setOpen(true)}
            aria-label="Open TIPE AI assistant"
            className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-blue-500 hover:scale-110 transition-transform relative"
          >
            <Sparkles className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[min(520px,70vh)]"
          >
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-sm">TIPE AI</span>
                <span className="text-[10px] text-slate-400">RAG · Pinecone + live news</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close assistant">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                      m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 p-3 rounded-2xl flex gap-1">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="p-3 border-t border-slate-100 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Top 3 buyers in Germany"
                className="flex-1 bg-slate-50 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button type="submit" disabled={busy || !input.trim()} className="bg-blue-600 text-white p-2 rounded-lg disabled:opacity-50" aria-label="Send">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
