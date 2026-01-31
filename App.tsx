
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
import { db, generateUserId } from './services/database';
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
            const configs = await db.entities.AppConfig.list();
            const cfg = configs[0];
            if (cfg) {
                setAppConfig(cfg);
                if (cfg.theme) {
                    if (cfg.theme.primaryColor) document.documentElement.style.setProperty('--primary-color', cfg.theme.primaryColor);
                    if (cfg.theme.secondaryColor) document.documentElement.style.setProperty('--secondary-color', cfg.theme.secondaryColor);
                }
            }
        } catch(e) {
            console.error("Erro ao carregar configurações", e);
        }
    };
    loadConfig();

    const saved = localStorage.getItem('adma_user');
    if (saved) {
        const u = JSON.parse(saved);
        setUser(u);
        setIsAuthenticated(true);
        // Chama loadProgress imediatamente ao restaurar sessão
        loadProgress(u.user_email, u.user_name);
    }
    
    const isDark = localStorage.getItem('adma_dark_mode') === 'true' || 
                 (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
      if (darkMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('adma_dark_mode', 'true');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('adma_dark_mode', 'false');
      }
  }, [darkMode]);

  // --- FUNÇÃO CRÍTICA DE SINCRONIZAÇÃO (ID FIXO + MIGRAÇÃO DE LEGADO) ---
  const loadProgress = async (email: string, nameFallback?: string) => {
    try {
        const userId = generateUserId(email); // ID Determinístico (Novo Padrão)
        console.log("Sincronizando usuário com ID Fixo:", userId);
        
        // 1. Busca perfil no padrão NOVO
        let p = await db.entities.ReadingProgress.get(userId);
        
        // 2. LÓGICA DE RECUPERAÇÃO (MIGRAÇÃO):
        // Se o perfil novo não existe OU existe mas está "vazio" (menos de 5 caps lidos, assumindo que usuários antigos têm mais),
        // procuramos por perfis LEGADOS com o mesmo email para recuperar os dados.
        if (!p || (p.total_chapters || 0) < 5) {
            console.log("Verificando existência de perfil legado para migração...");
            
            // Busca TODOS os usuários com este email
            const candidates = await db.entities.ReadingProgress.filter({ user_email: email });
            
            // Filtra: Pega qualquer um que NÃO seja o ID novo atual e tenha progresso relevante
            const legacyProfile = candidates.find((c: any) => c.id !== userId && (c.total_chapters || 0) > 0);

            if (legacyProfile) {
                console.log("⚠️ LEGADO ENCONTRADO! Migrando dados de:", legacyProfile.id, "para", userId);
                
                // Mescla os dados: Mantém o ID NOVO, mas puxa o progresso do ANTIGO
                const migratedData = {
                    ...legacyProfile,
                    id: userId, // CRÍTICO: Sobrescreve o ID antigo com o novo padrão determinístico
                    user_name: nameFallback || legacyProfile.user_name // Atualiza nome se disponível
                };

                // Salva o perfil migrado no novo endereço
                await db.entities.ReadingProgress.create(migratedData);
                
                // Define como perfil atual
                p = migratedData;

                // CRÍTICO: Deleta o perfil legado antigo para não duplicar no Ranking
                // Isso resolve o problema de ter "Michel Felix (56 caps)" e "Michel Felix (0 caps)" ao mesmo tempo.
                await db.entities.ReadingProgress.delete(legacyProfile.id);
                showToast("Progresso antigo restaurado e migrado com sucesso!", "success");
            }
        }

        // 3. Se após a tentativa de migração ainda não existir, cria perfil zerado
        if (!p) {
            console.log("Nenhum registro encontrado. Iniciando perfil novo com ID Fixo...");
            const displayName = nameFallback || user?.user_name || email;
            
            const newProfile = {
                id: userId,
                user_email: email, 
                user_name: displayName, 
                chapters_read: [], 
                total_chapters: 0,
                active_plans: [],
                ebd_read: [],
                total_ebd_read: 0,
                created_at: new Date().toISOString()
            };

            const created = await db.entities.ReadingProgress.create(newProfile);
            setUserProgress(created);
        } else {
            console.log("Progresso carregado:", p);
            setUserProgress(p);
        }
    } catch (error) {
        console.error("Erro crítico de sincronização no App.tsx:", error);
        showToast("Falha na sincronização. Verifique conexão.", "error");
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
      if (v.startsWith('module_')) {
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
                appConfig={appConfig}
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
            return <RankingView onBack={() => setView('dashboard')} userProgress={userProgress} />;
        case 'messages':
            return <MessagesView onBack={() => setView('dashboard')} isAdmin={isAdmin} user={user} />;
        case 'dynamic_module':
            return activeModule ? <DynamicModuleViewer module={activeModule} onBack={() => setView('dashboard')} /> : <div className="p-10 text-center">Módulo não encontrado</div>;
        default:
            return <div className="dark:text-white p-10 text-center font-cinzel">Página em Construção</div>;
    }
  };

  return (
    <div className="font-sans text-gray-900 dark:text-gray-100 min-h-screen bg-background dark:bg-dark-bg transition-colors duration-300 flex flex-col">
        <div className={`flex-1 ${isAuthenticated ? 'pb-20' : ''}`}>
            {renderView()}
        </div>
        
        {isAuthenticated && view !== 'dynamic_module' && view !== 'reader' && (
            <BottomNav currentView={view} onNavigate={handleNavigate} />
        )}

        <AdminPasswordModal isOpen={showAdminModal} onClose={() => setShowAdminModal(false)} onSuccess={handleAdminSuccess} />
        <NetworkStatus />
        {toast.msg && <Toast message={toast.msg} type={toast.type} onClose={() => setToast({ ...toast, msg: '' })} />}
    </div>
  );
}
