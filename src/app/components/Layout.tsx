import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Sparkles,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import { NewsTicker } from './NewsTicker';
import { ChatWidget } from './ChatWidget';
import { OfflineBanner } from './OfflineBanner';
import { clearCache, prefetchRoute, useConversations } from '../lib/queries';
import { useSession } from '../lib/session';
import { pages } from '../pageLoaders';

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

const mobileTabs = navItems.filter((n) => ['/', '/approve', '/conversations', '/analytics'].includes(n.path));

const isActivePath = (current: string, path: string) =>
  path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);

function NavLink({ item, active, badge, onClick }: { item: (typeof navItems)[number]; active: boolean; badge?: number; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      onMouseEnter={() => prefetchRoute(item.path)}
      onFocus={() => prefetchRoute(item.path)}
      className="relative block"
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <motion.div layoutId="activeNav" className="absolute inset-0 bg-blue-600 rounded-lg" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />
      )}
      <div className={`relative flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700/50'}`}>
        <Icon className="w-5 h-5" />
        <span className="font-medium text-sm flex-1">{item.label}</span>
        {!!badge && <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center">{badge}</span>}
      </div>
    </Link>
  );
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const { data: conversations } = useConversations();
  const unread = conversations?.reduce((n, c) => n + (c.unread || 0), 0) ?? 0;

  // Every page shares one scroll container, so reset it on navigation.
  // Otherwise the next page opens at the previous page's scroll offset.
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  // Warm every page chunk once the browser is idle so navigation is instant.
  useEffect(() => {
    const warm = () => Object.values(pages).forEach((load) => load().catch(() => {}));
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(warm, { timeout: 3000 }) : window.setTimeout(warm, 1500);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);

  const logout = () => {
    signOut();
    clearCache();
    navigate('/login', { replace: true });
  };

  const badgeFor = (path: string) => (path === '/conversations' ? unread : undefined);

  return (
    <div className="flex flex-col h-dvh bg-slate-50 overflow-hidden">
      <NewsTicker />
      <OfflineBanner />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex-col shadow-2xl z-40">
          <div className="p-6 border-b border-slate-700">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-xl leading-tight">TIPE</h1>
                <p className="text-xs text-slate-400">Trade Intent Prediction</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.path} item={item} active={isActivePath(location.pathname, item.path)} badge={badgeFor(item.path)} />
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700 space-y-2">
            {user && (
              <div className="px-4 text-xs text-slate-400 truncate" title={user.email}>
                {user.company_name || user.email}
                <div className="capitalize text-slate-500">{user.category} · {user.industry}</div>
              </div>
            )}
            <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors">
              <LogOut className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        </aside>

        {/* Mobile Nav Drawer */}
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
                transition={{ type: 'tween', duration: 0.2 }}
                className="fixed inset-y-0 left-0 w-64 bg-slate-900 text-white z-50 flex flex-col lg:hidden"
              >
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-blue-500" />
                    <h1 className="font-bold text-xl">TIPE</h1>
                  </div>
                  <button onClick={() => setIsSidebarOpen(false)} aria-label="Close menu"><X className="w-6 h-6" /></button>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => (
                    <NavLink key={item.path} item={item} active={isActivePath(location.pathname, item.path)} badge={badgeFor(item.path)} onClick={() => setIsSidebarOpen(false)} />
                  ))}
                </nav>
                <button onClick={logout} className="m-4 flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-700/50 rounded-lg">
                  <LogOut className="w-5 h-5" /> <span className="text-sm">Logout</span>
                </button>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto relative">
            <Outlet />
          </main>

          {/* Mobile Bottom Tab Bar */}
          <nav className="lg:hidden h-16 bg-white border-t border-slate-200 flex justify-around items-center px-4 shrink-0">
            {mobileTabs.map(({ path, icon: Icon, label }) => (
              <Link key={path} to={path} aria-label={label} className={`relative p-2 ${isActivePath(location.pathname, path) ? 'text-blue-600' : 'text-slate-400'}`}>
                <Icon className="w-6 h-6" />
                {path === '/conversations' && unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600" />}
              </Link>
            ))}
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400" aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
          </nav>
        </div>
      </div>

      {/* The deck's action buttons and the chat composer sit where the FAB would on phones. */}
      <ChatWidget hideOnMobile={location.pathname === '/approve' || location.pathname.startsWith('/conversations')} />
    </div>
  );
}
