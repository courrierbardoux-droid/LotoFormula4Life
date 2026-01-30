
import React, { useEffect } from 'react';
// import generatedImage from '@assets/generated_images/abstract_tv_studio_background_for_lottery_show.png';
import { useLocation } from "wouter";
import { LogOut } from "lucide-react";

interface CasinoLayoutProps {
  children: React.ReactNode;
}

export const CasinoLayout = ({ children }: CasinoLayoutProps) => {
  const [location, setLocation] = useLocation();

  // Redirection admin vers historique utilisateurs si pendingAdminWinsRedirect est défini
  // Cela se déclenche quand l'admin quitte /my-grids après avoir vu ses gains
  useEffect(() => {
    const pending = sessionStorage.getItem('pendingAdminWinsRedirect');
    if (pending === '1' && location !== '/my-grids' && !location.startsWith('/settings/users/history')) {
      sessionStorage.removeItem('pendingAdminWinsRedirect');
      setLocation('/settings/users/history?wins=1');
    }
  }, [location, setLocation]);

  const handleLogout = () => {
    // Clear any local storage auth if we had it
    setLocation("/");
  };

  const showLogout = location !== "/";

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-auto flex flex-col relative font-rajdhani">
      {/* Background Image */}
      <div 
        className="fixed inset-0 z-0 opacity-40 pointer-events-none"
        style={{ 
          backgroundImage: `none`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />
      
      {/* Overlay Gradient - subtler for visibility */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/30 via-transparent to-black/50 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>

      {/* Footer / Signature */}
      <footer className="relative z-20 py-2 text-center text-xs text-muted-foreground font-orbitron opacity-50 border-t border-white/5 mt-auto">
        LOTOFORMULA4LIFE © 2025 • A&C STUDIO
      </footer>
    </div>
  );
};
