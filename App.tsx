import React, { useState, useEffect } from 'react';
import LoginScreen from './components/auth/LoginScreen';
import DashboardHome from './components/dashboard/DashboardHome';
import BibleReader from './components/bible/BibleReader';
import AdminPanel from './components/admin/AdminPanel';
import PanoramaView from './components/panorama/PanoramaView';
import DevotionalView from './components/devotional/DevotionalView';
import PlansView from './components/plans/PlansView';
import RankingView from './components/ranking/RankingView';
import MessagesView from './components/messages/MessagesView';
import DynamicModuleViewer from './components/dynamic/DynamicModuleViewer';
import AdminPasswordModal from './components/modals/AdminPasswordModal';
import Toast from './components/ui/Toast';
import BottomNav from './components/ui/BottomNav';
import NetworkStatus from './components/ui/NetworkStatus';
import { db } from './services/database';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProgress, setUserProgress] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState({ msg: '', type: 'info' as any });
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [navParams, setNavParams] = useState<any>({});
  const [appConfig, setAppConfig] = useState<any>(null);
  const [activeModule, setActiveModule] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('adma_user');
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      setIsAuthenticated(true);
      loadProgress(u.user_email, u.user_name);
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) setDarkMode(true);
    loadAppConfig();
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  const loadAppConfig = async () => {
    try {
        const configs = await db.entities.AppConfig.list();
        setAppConfig(configs[0] || null);
    } catch(e) {}
  };

  const loadProgress = async (email: string, name: string) => {
    const p = await db.entities.ReadingProgress.filter({ user_email: email });
    if (p.length) setUserProgress(p[0]);
    else {
      const newP = await db.entities.ReadingProgress.create({ user_email: email, user_name: name, chapters_read: [], total_chapters: 0, ebd_read: [], total_ebd_read: 0 });
      setUserProgress(newP);
    }
  };

  const handleLogin = (first: string, last: string) => {
    const u = { user_name: `${first} ${last}`, user_email: `${first.trim().toLowerCase()}.${last.trim().toLowerCase()}@adma.local` };
    localStorage.setItem('adma_user', JSON.stringify(u));
    setUser(u);
    setIsAuthenticated(true);
    loadProgress(u.user_email, u.user_name);
  };

  const handleNavigate = (v: string, p: any = {}) => {
      if (v === 'reader' && p.book) {
          setNavParams(p);
      }
      if (p.module) setActiveModule(p.module);
      setView(v);
      window.scrollTo(0,0);
  };

  const showToast = (msg: string, type: any) => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'info' }), 3000);
  };

  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} loading={false} />;

  const renderView = () => {
    switch(view) {
      case 'dashboard': return <DashboardHome onNavigate={handleNavigate} isAdmin={isAdmin} onEnableAdmin={() => setShowAdminModal(true)} user={user} userProgress={userProgress} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} onShowToast={showToast} onLogout={() => { localStorage.removeItem('adma_user'); window.location.reload(); }} appConfig={appConfig} />;
      case 'reader': return <BibleReader onBack={() => setView('dashboard')} isAdmin={isAdmin} onShowToast={showToast} initialBook={navParams.book} initialChapter={navParams.chapter} userProgress={userProgress} onProgressUpdate={setUserProgress} />;
      case 'admin': return <AdminPanel onBack={() => setView('dashboard')} onShowToast={showToast} />;
      case 'panorama': return <PanoramaView onBack={() => setView('dashboard')} isAdmin={isAdmin} onShowToast={showToast} userProgress={userProgress} onProgressUpdate={setUserProgress} />;
      case 'devotional': return <DevotionalView onBack={() => setView('dashboard')} onShowToast={showToast} isAdmin={isAdmin} />;
      case 'plans': return <PlansView onBack={() => setView('dashboard')} onNavigate={handleNavigate} userProgress={userProgress} />;
      case 'ranking': return <RankingView onBack={() => setView('dashboard')} />;
      case 'messages': return <MessagesView onBack={() => setView('dashboard')} isAdmin={isAdmin} user={user} />;
      case 'dynamic_module': return <DynamicModuleViewer module={activeModule} onBack={() => setView('dashboard')} />;
      default: return <div>Página não encontrada</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-dark-bg text-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-500">
      <div className="flex-1 pb-20">{renderView()}</div>
      {view !== 'dynamic_module' && view !== 'reader' && <BottomNav currentView={view} onNavigate={setView} />}
      <AdminPasswordModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} onSuccess={() => { setIsAdmin(true); setShowAdminModal(false); showToast('Admin Ativado!', 'success'); }} />
      <NetworkStatus />
      {toast.msg && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'info' })} />}
    </div>
  );
}
