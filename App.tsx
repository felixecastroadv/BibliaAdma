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
import { AppConfig, DynamicModule } from './types';

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

  // Config e Módulos Dinâmicos
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [activeModule, setActiveModule] = useState<DynamicModule | null>(null);

  useEffect(() => {
    // 1. Carrega Config Global
    const loadConfig = async () => {
        try {
            const cfg = await db.entities.AppConfig.get();
            if (cfg) {
                setAppConfig(cfg);
                // Aplica Cores Dinâmicas
                if (cfg.theme) {
                    document.documentElement.style.setProperty('--primary-color', cfg.theme.primaryColor);
                    document.documentElement.style.setProperty('--secondary-color', cfg.theme.secondaryColor);
                }
            }
        } catch(e) {}
    };
    loadConfig();

    const saved = localStorage.getItem('adma_user');
    if (saved) {
        const u = JSON.parse(saved);
        setUser(u);
        setIsAuthenticated(true);
        loadProgress(u.user_email, u.user_name);
    }
    
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

  const loadProgress = async (email: string, nameFallback?: string) => {
    const p = await db.entities.ReadingProgress.filter({ user_email: email });
    if (p.length) setUserProgress(p[0]);
    else {
        const displayName = nameFallback || user?.user_name || email;
        const newP = await db.entities.ReadingProgress.create({ 
            user_email: email, 
            user_name: displayName, 
            chapters_read: [], 
            total_chapters: 0,
            active_plans: [],
            ebd_read: [],
            total_ebd_read: 0
        });
        setUserProgress(newP);
    }
  };

  const handleLogin = (first: string, last: string) => {
    const fullName = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@adma.local`;
    const u = { user_name: fullName, user_email: email };
    
    localStorage.setItem('adma_user', JSON.stringify(u));
    setUser(u);
    setIsAuthenticated(true);
    loadProgress(email, fullName);
  };

  const handleLogout = () => {
      if(window.confirm("Deseja realmente sair e trocar de usuário?")) {
          localStorage.removeItem('adma_user');
          setUser(null);
          setUserProgress(null);
          setIsAuthenticated(false);
          setIsAdmin(false);
          setView('dashboard');
      }
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
      // Se for navegação para módulo dinâmico
      if (v.startsWith('module_')) {
          const modId = v.replace('module_', '');
          // O Dashboard passará o objeto do módulo em params, ou buscamos do estado global
          if (params && params.module) {
              setActiveModule(params.module);
              setView('dynamic_module');
          }
          return;
      }
      
      setView(v);
      if(params) setNavParams(params);
      window.scrollTo(0, 0);
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
                onLogout={handleLogout}
                appConfig={appConfig} // Passa Config
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
            return <PanoramaView 
                onBack={() => setView('dashboard')} 
                isAdmin={isAdmin} 
                onShowToast={showToast}
                userProgress={userProgress} 
                onProgressUpdate={setUserProgress} 
            />;
        case 'devotional':
            return <DevotionalView onBack={() => setView('dashboard')} onShowToast={showToast} isAdmin={isAdmin} />;
        case 'plans':
            return <PlansView onBack={() => setView('dashboard')} onNavigate={handleNavigate} userProgress={userProgress} />;
        case 'ranking':
            return <RankingView onBack={() => setView('dashboard')} />;
        case 'messages':
            return <MessagesView onBack={() => setView('dashboard')} isAdmin={isAdmin} user={user} />;
        case 'dynamic_module':
            return activeModule ? <DynamicModuleViewer module={activeModule} onBack={() => setView('dashboard')} /> : <div>Módulo não encontrado</div>;
        default:
            return <div className="dark:text-white">Page not found</div>;
    }
  };

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 min-h-screen bg-background dark:bg-dark-bg transition-colors duration-300 flex flex-col">
        <div className={`flex-1 ${isAuthenticated ? 'pb-20' : ''}`}>
            {renderView()}
        </div>
        
        {isAuthenticated && view !== 'dynamic_module' && (
            <BottomNav currentView={view} onNavigate={handleNavigate} />
        )}

        <AdminPasswordModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} onSuccess={handleAdminSuccess} />
        <NetworkStatus />
        {toast.msg && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, msg: '' })} />}
    </div>
  );
}