import * as React from 'react';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { OverviewTab } from './components/OverviewTab';
import { ChatsTab } from './components/ChatsTab';
import { OrganizeTab } from './components/OrganizeTab';
import { ScheduleTab } from './components/ScheduleTab';
import { SettingsTab } from './components/SettingsTab';
import { Button } from './components/ui/Button';
import { callEndpoint, initTelegramApp, openTelegramLink, haptic } from './lib/telegram';
import { RefreshCw, Bot } from 'lucide-react';

function DashboardContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('overview');
  const [chatFilter, setChatFilter] = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [isDemo, setIsDemo] = React.useState(false);
  const realDataBackup = React.useRef(null);
  const [initialTargetChatId, setInitialTargetChatId] = React.useState(null);

  const loadData = React.useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      setError(null);
      const res = await callEndpoint('dashboard', {});
      setData(res);
      realDataBackup.current = res;
      if (showToast) toast('Dados atualizados do servidor.', 'success');
    } catch (err) {
      console.warn('Failed to load dashboard data:', err);
      setError(err.message || 'Falha ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleSyncVersion = React.useCallback((newVersion, freshData) => {
    setData((prev) => {
      if (freshData) return { ...freshData };
      return prev ? { ...prev, version: newVersion } : prev;
    });
  }, []);

  React.useEffect(() => {
    initTelegramApp();
    loadData();

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));
      const tabParam = urlParams.get('tab') || hashParams.get('tab');
      const chatParam = urlParams.get('chat') || hashParams.get('chat');

      const tgStartParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
      let deepChatId = chatParam;
      if (!deepChatId && tgStartParam) {
        if (tgStartParam.startsWith('chat_')) {
          deepChatId = tgStartParam.replace('chat_', '');
        } else if (/^-?\d+$/.test(tgStartParam)) {
          deepChatId = tgStartParam;
        }
      }

      if (tabParam === 'chats' || deepChatId) {
        setActiveTab('chats');
        setChatFilter('all');
      }
      if (deepChatId) {
        setInitialTargetChatId(deepChatId);
      }
    } catch (e) {
      console.warn('Erro ao processar parâmetros da URL:', e);
    }
  }, [loadData]);

  // Demo mode toggle
  const handleToggleDemo = () => {
    haptic('medium');
    if (!isDemo) {
      const names = [
        'Clube dos Livros', 'Papo Livre', 'Cinema em Casa', 'Música Todo Dia',
        'Notícias Agora', 'Curso de Inglês', 'Humor BR', 'Investidores Iniciantes',
        'Eventos da Cidade', 'Receitas e Amigos', 'Biblioteca Digital', 'Séries em Debate',
        'Rock e Companhia', 'Estudos para Concursos', 'Amizades Brasil', 'Resumo das Notícias',
        'Comunidade Geral', 'Apostas em Debate', 'Comunidade +18', 'Filmes de Domingo'
      ];
      const categories = [9, 2, 7, 10, 11, 5, 4, 8, 6, 2, 9, 7, 10, 5, 2, 11, 0, 3, 1, 7];
      const members = [25, 50, 99, 100, 101, 150, 200, 250, 300, 400, 500, 600, 750, 900, 1000, 1500, 2000, 3000, 5000, 10000];

      const demoData = {
        ...(data || {}),
        id: 7595607953,
        demo: true,
        version: (data?.version || 1) + 1,
        schedulerHeartbeat: Date.now(),
        settings: {
          ...(data?.settings || {}),
          approval: 'manual',
        },
        chats: names.map((title, i) => ({
          id: -9000000 - i,
          title,
          display: '',
          type: i % 2 === 0 ? 'channel' : 'supergroup',
          category: categories[i],
          members: members[i],
          membersCheckedAt: Date.now(),
          status: i < 5 ? 'pending' : i < 16 ? 'approved' : 'rejected',
          url: `https://t.me/demo_${i + 1}`,
          owner: 7595607953,
          ownerName: 'Admin',
          position: i,
          updated: Date.now(),
        })),
        ads: [
          {
            id: 1,
            title: '📣 Comunidade Parceira',
            url: 'https://t.me/canalparceiro',
            style: 'primary',
            slot_row: 0,
            slot_col: 0,
          },
        ],
      };

      setError(null);
      setData(demoData);
      setIsDemo(true);
      toast('Modo Demonstração ativado (20 canais simulados)', 'info');
    } else {
      setIsDemo(false);
      if (realDataBackup.current) {
        setData(realDataBackup.current);
      } else {
        loadData();
      }
      toast('Modo Demonstração encerrado', 'info');
    }
  };

  const handleNavigate = (tab, filter = 'all') => {
    setActiveTab(tab);
    if (tab === 'chats' && filter) {
      setChatFilter(filter);
    }
  };

  // Loading state
  if (loading && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
        <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-200">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg animate-pulse">
            <Bot className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Conectando ao Telegram…</h2>
            <p className="text-xs text-muted-foreground">Carregando painel administrativo</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state (outside Telegram or auth failed)
  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-background text-foreground">
        <div className="rounded-3xl border border-white/10 bg-card p-6 max-w-sm w-full space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">ListaMyBOT</h2>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              onClick={() => loadData()}
              className="w-full text-xs font-semibold h-9"
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Tentar Novamente
            </Button>
            <Button
              variant="outline"
              onClick={() => openTelegramLink('https://t.me/ListaMyBOT')}
              className="w-full text-xs border-white/10 h-9"
            >
              Abrir bot no Telegram
            </Button>
            <Button
              variant="ghost"
              onClick={handleToggleDemo}
              className="w-full text-xs text-amber-400 hover:bg-amber-500/10 h-9"
            >
              Explorar modo de testes (Demo)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = (data?.chats || []).filter((c) => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header
        data={data}
        loading={loading}
        onRefresh={() => loadData(true)}
        isDemo={isDemo}
        onToggleDemo={handleToggleDemo}
      />

      <main className="flex-1 mx-auto w-full max-w-4xl px-3.5 pt-4">
        {activeTab === 'overview' && (
          <OverviewTab
            data={data}
            onNavigateTab={handleNavigate}
            onRefresh={() => loadData()}
            isDemo={isDemo}
          />
        )}

        {activeTab === 'chats' && (
          <ChatsTab
            data={data}
            initialFilter={chatFilter}
            onRefresh={() => loadData()}
            isDemo={isDemo}
            initialChatId={initialTargetChatId}
          />
        )}

        {activeTab === 'organize' && (
          <OrganizeTab
            data={data}
            onRefresh={() => loadData()}
            isDemo={isDemo}
            onSyncVersion={handleSyncVersion}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            data={data}
            onRefresh={() => loadData()}
            isDemo={isDemo}
            onSyncVersion={handleSyncVersion}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            data={data}
            onRefresh={() => loadData()}
            isDemo={isDemo}
            onToggleDemo={handleToggleDemo}
            onSyncVersion={handleSyncVersion}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={pendingCount}
      />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <DashboardContent />
    </ToastProvider>
  );
}

export default App;
