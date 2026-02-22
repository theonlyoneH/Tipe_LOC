import { Link, Outlet, useLocation } from 'react-router';
import {
  LayoutDashboard,
  ThumbsUp,
  CheckCircle2,
  MessageSquare,
  Calendar,
  BarChart3,
  FileText,
  User,
  LogOut,
  Sparkles,
  Send,
  X,
  MessageCircle
} from 'lucide-react';
import { fetchTradeSignals } from "../lib/scroll";
//hao
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../lib/api';


const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/approve', label: 'Approve Leads', icon: ThumbsUp },
  { path: '/approved', label: 'Approved Leads', icon: CheckCircle2 },
  { path: '/conversations', label: 'Conversations', icon: MessageSquare },
  { path: '/meetings', label: 'Meetings', icon: Calendar },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/content', label: 'Content Engine', icon: FileText },
  { path: '/profile', label: 'Profile', icon: User },
];

export function Layout() {
  const [tradeSignals, setTradeSignals] = useState<any[]>([]);
  useEffect(() => {
    const loadSignals = async () => {
      const data = await fetchTradeSignals();
      setTradeSignals(data);
    };

    loadSignals();
    const interval = setInterval(loadSignals, 30000);

    return () => clearInterval(interval);
  }, []);
  //  useEffect(() => {
  //   const fetchTradeSignals = async () => {
  //     try {
  //       const res = await fetch(
  //         "http://localhost:8000/news/trade_signals_output.json",
  //         { cache: "no-store" }
  //       );
  //       const data = await res.json();
  //       setTradeSignals(data);
  //     } catch (error) {
  //       console.error("Failed to load trade signals:", error);
  //     }
  //   };

  //   fetchTradeSignals();
  //   const interval = setInterval(fetchTradeSignals, 60000);
  //   return () => clearInterval(interval);
  // }, []);


  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello! I am your TIPE Assistant. How can I help you today? ✨', time: new Date() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isTyping]);


  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMsg = { role: 'user', text: inputValue, time: new Date() };
    setMessages(prev => [...prev, userMsg]);

    const messageToSend = inputValue; // store before clearing
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await sendChatMessage(messageToSend);

      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: response.answer || response.response || JSON.stringify(response),
          time: new Date()
        }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: "Backend not reachable ",
          time: new Date()
        }
      ]);
    }

    setIsTyping(false);
  };
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Stock Ticker */}
      <div className="h-8 bg-slate-900 text-white flex items-center overflow-hidden border-b border-slate-700 relative z-50">
        <motion.div
          animate={{ x: [1000, -2000] }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
          className="whitespace-nowrap text-xs font-medium flex gap-12"
        >
          {tradeSignals.length > 0 ? (
            tradeSignals.map((item, index) => {
              const score = item?.ai_analysis?.trade_signal_score ?? 0;
              const tag = item?.ai_analysis?.importance_tag ?? "Trade Update";
              const headline = item?.headline ?? "";

              let emoji = "🟡";
              if (score >= 0.75) emoji = "🔴";
              else if (score >= 0.6) emoji = "🟢";

              return (
                <span key={index}>
                  {emoji} {tag} — {headline.slice(0, 80)}...
                </span>
              );
            })
          ) : (
            <span>Loading trade intelligence...</span>
          )}
        </motion.div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex-col shadow-2xl z-40">
          <div className="p-6 border-b border-slate-700">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-xl">TIPE</h1>
                <p className="text-xs text-slate-400">Trade Intent Prediction</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Link key={item.path} to={item.path} className="relative block">
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-blue-600 rounded-lg"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <div className={`relative flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-700">
            <button
              onClick={() => {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                window.location.href = '/login';
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        </aside>

        {/* Mobile Nav Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden"
              />
              <motion.aside
                initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
                className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 flex flex-col lg:hidden"
              >
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-blue-500" />
                    <h1 className="font-bold text-xl">TIPE</h1>
                  </div>
                  <X className="w-6 h-6" onClick={() => setIsSidebarOpen(false)} />
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <Link key={item.path} to={item.path} onClick={() => setIsSidebarOpen(false)} className="block">
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${isActive ? 'bg-blue-600 text-white' : 'text-slate-300'}`}>
                          <Icon className="w-5 h-5" />
                          <span className="font-medium text-sm">{item.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1 overflow-auto relative">
            <Outlet />

            {/* AI Chatbot */}
            <div className="fixed bottom-20 lg:bottom-8 right-8 z-50">
              {!isChatOpen ? (
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl border-2 border-blue-500 hover:scale-110 transition-transform relative group"
                >
                  <Sparkles className="w-6 h-6" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="w-80 lg:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[500px]"
                >
                  <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-400" />
                      <span className="font-bold text-sm">TIPE AI </span>
                    </div>
                    <X className="w-5 h-5 cursor-pointer" onClick={() => setIsChatOpen(false)} />
                  </div>
                  <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 p-3 rounded-2xl flex gap-1">
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
                          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-300" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-slate-100 flex gap-2">
                    <input
                      type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask about leads..."
                      className="flex-1 bg-slate-50 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button onClick={handleSendMessage} className="bg-blue-600 text-white p-2 rounded-lg">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </main>

          {/* Mobile Bottom Tab Bar */}
          <nav className="lg:hidden h-16 bg-white border-t border-slate-200 flex justify-around items-center px-4 pb-safe">
            <Link to="/" className={`p-2 ${location.pathname === '/' ? 'text-blue-600' : 'text-slate-400'}`}>
              <LayoutDashboard className="w-6 h-6" />
            </Link>
            <Link to="/approve" className={`p-2 ${location.pathname === '/approve' ? 'text-blue-600' : 'text-slate-400'}`}>
              <ThumbsUp className="w-6 h-6" />
            </Link>
            <Link to="/approved" className={`p-2 ${location.pathname === '/approved' ? 'text-blue-600' : 'text-slate-400'}`}>
              <CheckCircle2 className="w-6 h-6" />
            </Link>
            <Link to="/analytics" className={`p-2 ${location.pathname === '/analytics' ? 'text-blue-600' : 'text-slate-400'}`}>
              <BarChart3 className="w-6 h-6" />
            </Link>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">
              <span className="text-xl">☰</span>
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

}