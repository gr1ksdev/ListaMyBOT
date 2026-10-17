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
import { callEndpoint, initTelegramApp, haptic } from './lib/telegram';
import { RefreshCw, AlertCircle, Bot } from 'lucide-react';

function DashboardContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState('overview');
  const [chatFilter, setChatFilter] = React.useState('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [data, setData] = React.useState(null);
  const [isDemo, setIsDemo] = React.useState(false);
  const realDataBackup = React.useRef(null);

  const loadData = React.useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      setError(null);
      const res = await callEndpoint('dashboard', {});
      setData(res);
      realDataBackup.current = res;
      if (showToast) toast('Dados atualizados do servidor.', 'success');
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.message || 'Falha ao carregar dados do painel');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    initTelegramApp();
    loadData();
  }, [loadData]);

  // Demo mode toggle
  const handleToggleDemo = () => {
    haptic('medium');
    if (!isDemo) {
      // Enter demo
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
        ...data,
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
          ownerName: 'Gabriel Admin',
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

      setData(demoData);
      setIsDemo(true);
      toast('Modo Demonstração ativado (20 canais simulados)', 'info');
    } else {
      // Exit demo
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

  // If initial load failed with error
  if (error && !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 max-w-sm w-full space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Erro ao carregar</h2>
          <p className="text-xs text-slate-400">{error}</p>
          <Button
            variant="primary"
            onClick={() => loadData()}
            className="w-full"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  const pendingCount = (data?.chats || []).filter((c) => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-slate-950 flex flex-col">
      <Header
        data={data}
        loading={loading}
        onRefresh={() => loadData(true)}
        isDemo={isDemo}
        onToggleDemo={handleToggleDemo}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 pt-5">
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
          />
        )}

        {activeTab === 'organize' && (
          <OrganizeTab
            data={data}
            onRefresh={() => loadData()}
            isDemo={isDemo}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            data={data}
            onRefresh={() => loadData()}
            isDemo={isDemo}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            data={data}
            onRefresh={() => loadData()}
            isDemo={isDemo}
            onToggleDemo={handleToggleDemo}
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
