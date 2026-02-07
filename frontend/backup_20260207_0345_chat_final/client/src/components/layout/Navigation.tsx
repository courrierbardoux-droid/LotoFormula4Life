
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Home, BookOpen, User, History, Grid, FileText, Shield, LogOut, Users, Settings, ChevronDown } from 'lucide-react';
import { useUser } from '@/lib/UserContext';
import { cn } from '@/lib/utils';
import { Howl } from 'howler';

const menuSound = new Howl({
    src: ['https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'], // Placeholder
    volume: 0.2
});

export const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useUser();
  const [location] = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Auto-open the group matching the current location (without auto-closing others)
    setOpenGroups((prev) => ({
      ...prev,
      settings: prev.settings || (location.startsWith("/settings") && !location.startsWith("/settings/users")),
      users: prev.users || location.startsWith("/settings/users"),
    }));
  }, [location]);

  const toggleMenu = () => {
    menuSound.play();
    setIsOpen(!isOpen);
  };

  const menuItems: Array<
    | { icon: any; label: string; path: string }
    | { icon: any; label: string; groupKey: "settings" | "users"; children: Array<{ label: string; path: string }> }
  > = [
    { icon: Home, label: 'Accueil / Console', path: user?.role === 'admin' ? '/admin' : '/dashboard' },
    { icon: BookOpen, label: 'Comment ça marche ?', path: '/presentation' },
    { icon: User, label: 'Mon Profil', path: '/profile' },
    { icon: Grid, label: 'Mes Grilles Jouées', path: '/my-grids' },
    { icon: History, label: 'Historique EuroMillions', path: '/history' },
    { icon: FileText, label: 'Règles du Jeu', path: '/rules' },
    { icon: Shield, label: 'CGU', path: '/cgu' },
  ];

  if (user?.role === 'admin') {
    menuItems.splice(5, 0, {
      icon: Settings,
      label: 'Paramètres',
      groupKey: "settings",
      children: [
        { label: 'Fenêtre de calcul par pool', path: '/settings/windows' },
        { label: 'Gestion des pop-up et e-mails', path: '/settings/popups-emails' },
      ],
    });
    menuItems.splice(6, 0, {
      icon: Users,
      label: 'Gestion utilisateurs',
      groupKey: "users",
      children: [
        { label: 'Informations utilisateurs', path: '/settings/users' },
        { label: 'Historique des utilisateurs', path: '/settings/users/history' },
      ],
    });
  } else {
    menuItems.splice(5, 0, { icon: Settings, label: 'Paramètres', path: '/settings' });
  }

  if (!user) return null;

  return (
    <>
      <button 
        onClick={toggleMenu}
        className="fixed top-4 left-4 z-50 p-3 bg-black/80 border-2 border-zinc-700 text-casino-gold rounded-xl hover:bg-zinc-900 transition-colors"
      >
        {isOpen ? <X size={32} /> : <Menu size={32} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 left-0 h-full w-[400px] bg-zinc-950 border-r-2 border-casino-gold/30 z-50 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 border-b-2 border-zinc-800">
          <h2 className="font-orbitron text-3xl text-casino-gold tracking-widest leading-none">MENU</h2>
          <p className="text-xl text-zinc-500 mt-2 font-rajdhani">Bienvenue, {user.username}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-6 space-y-2">
          {menuItems.map((item) => {
            if ("children" in item) {
              const anyChildActive = item.children.some((c) => location === c.path);
              const isUsersGroup = item.groupKey === "users";
              const groupActive = anyChildActive
                ? true
                : isUsersGroup
                  ? location.startsWith("/settings/users")
                  : location.startsWith("/settings") && !location.startsWith("/settings/users");
              const isOpenGroup = !!openGroups[item.groupKey];
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl font-rajdhani text-xl transition-all hover:pl-6",
                      groupActive
                        ? "bg-casino-gold/10 text-casino-gold border-l-4 border-casino-gold"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    )}
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [item.groupKey]: !prev[item.groupKey],
                      }))
                    }
                  >
                    <item.icon size={24} />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown size={20} className={cn("transition-transform", isOpenGroup ? "rotate-180" : "")} />
                  </button>

                  {isOpenGroup && (
                    <div className="pl-6 space-y-1">
                      {item.children.map((child) => (
                        <Link key={child.path} href={child.path}>
                          <a
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl font-rajdhani text-lg transition-all hover:pl-5",
                              location === child.path
                                ? "bg-casino-gold/10 text-casino-gold border-l-4 border-casino-gold"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                            onClick={() => setIsOpen(false)}
                          >
                            <span className="w-2 h-2 rounded-full bg-zinc-600" />
                            {child.label}
                          </a>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link key={item.path} href={item.path}>
                <a
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl font-rajdhani text-xl transition-all hover:pl-6",
                    location === item.path
                      ? "bg-casino-gold/10 text-casino-gold border-l-4 border-casino-gold"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon size={24} />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t-2 border-zinc-800">
          <button 
            onClick={() => { logout(); setIsOpen(false); }}
            className="flex items-center gap-4 w-full p-4 text-red-400 hover:text-red-300 hover:bg-red-900/10 rounded-xl transition-colors font-rajdhani text-xl"
          >
            <LogOut size={24} />
            Déconnexion
          </button>
        </div>
      </div>
    </>
  );
};
