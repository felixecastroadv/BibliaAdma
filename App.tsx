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
import AdminPasswordModal from './components/modals/AdminPasswordModal';
import Toast from './components/ui/Toast';
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

  useEffect(() => {
    const saved = localStorage.getItem('adma_user');
    if (saved) {
        const u = JSON.parse(saved);
        setUser(u);
        setIsAuthenticated(true);
        loadProgress(u.user_email);
    }
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setDarkMode(true);
    }
  }, []);

  useEffect(() => {
      if (darkMode) {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
  }, [darkMode]);

  const loadProgress = async (email: string) => {
    const p = await db.entities.ReadingProgress.filter({ user_email: email });
    if (p.length) setUserProgress(p[0]);
    else {
        const newP = await db.entities.ReadingProgress.create({ 
            user_email: email, 
            user_name: user?.user_name || email, 
            chapters_read: [], 
            total_chapters: 0,
            active_plans: [] // Inicializa planos vazios
        });
        setUserProgress(newP);
    }
  };

  const handleLogin = (first: string, last: string) => {
    const u = { user_name: `${first} ${last}`, user_email: `${first.toLowerCase()}.${last.toLowerCase()}@adma.local` };
    localStorage.setItem('adma_user', JSON.stringify(u));
    setUser(u);
    setIsAuthenticated(true);
    loadProgress(u.user_email);
  };

  const showToast = (msg: string, type: 'success'|'error'|'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'info' }), 5000);
  };

  const handleAdminSuccess = () => {
    setIsAdmin(true);
    setShowAdminModal(false);
    showToast('Modo Admin Ativado!', 'success');
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const handleNavigate = (v: string, params?: any) => {
      setView(v);
      if(params) setNavParams(params);
  };

  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} loading={false} />;

  const renderView = () => {
    switch(view) {
        case 'dashboard':
            return <DashboardHome 
                onNavigate={handleNavigate} 
                isAdmin={isAdmin} 
                onEnableAdmin={() => setShowAdminModal(true)}
                user={user}
                userProgress={userProgress}
                darkMode={darkMode}
                toggleDarkMode={toggleDarkMode}
                onShowToast={showToast}
            />;
        case 'reader':
            return <BibleReader 
                onBack={() => setView('dashboard')} 
                isAdmin={isAdmin}
                onShowToast={showToast}
                initialBook={navParams.book}
                initialChapter={navParams.chapter}
                userProgress={userProgress}
                onProgressUpdate={setUserProgress}
            />;
        case 'admin':
            return <AdminPanel onBack={() => setView('dashboard')} onShowToast={showToast} />;
        case 'panorama':
            return <PanoramaView onBack={() => setView('dashboard')} isAdmin={isAdmin} onShowToast={showToast} />;
        case 'devotional':
            return <DevotionalView onBack={() => setView('dashboard')} onShowToast={showToast} isAdmin={isAdmin} />;
        case 'plans':
            return <PlansView onBack={() => setView('dashboard')} onNavigate={handleNavigate} userProgress={userProgress} />;
        case 'ranking':
            return <RankingView onBack={() => setView('dashboard')} />;
        case 'messages':
            return <MessagesView onBack={() => setView('dashboard')} />;
        default:
            return <div className="dark:text-white">Page not found</div>;
    }
  };

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 min-h-screen bg-background dark:bg-dark-bg transition-colors duration-300">
        {renderView()}
        <AdminPasswordModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} onSuccess={handleAdminSuccess} />
        {toast.msg && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, msg: '' })} />}
    </div>
  );
}