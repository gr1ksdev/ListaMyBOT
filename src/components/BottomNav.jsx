import * as React from 'react';
import { LayoutDashboard, CheckSquare, Palette, Clock, Sliders } from 'lucide-react';
import { haptic } from '@/lib/telegram';
import { cn } from '@/lib/utils';

export function BottomNav({ activeTab, onTabChange, pendingCount }) {
  const tabs = [
    { id: 'overview', label: 'Início', icon: LayoutDashboard },
    { id: 'chats', label: 'Canais', icon: CheckSquare, badge: pendingCount > 0 ? pendingCount : null },
    { id: 'organize', label: 'Organizar', icon: Palette },
    { id: 'schedule', label: 'Agendar', icon: Clock },
    { id: 'settings', label: 'Ajustes', icon: Sliders },
  ];

  const handleSelect = (id) => {
    haptic('selection');
    onTabChange(id);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-xl pb-safe">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className={cn(
                'group relative flex flex-1 flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 cursor-pointer',
                isActive ? 'text-sky-400 font-medium' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    isActive ? 'scale-110 text-sky-400' : 'group-hover:scale-105'
                  )}
                />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-950 animate-in zoom-in-75">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="mt-1 text-[11px] leading-tight tracking-tight select-none">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 h-0.5 w-6 rounded-full bg-sky-400 animate-in fade-in zoom-in-50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
