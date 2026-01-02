
import React from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';
import { useUser } from '@/lib/UserContext';
import { CasinoButton } from '@/components/casino/CasinoButton';

export default function Profile() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <CasinoLayout>
      <div className="max-w-2xl mx-auto p-6 md:p-12 mt-10">
        <div className="bg-zinc-900/90 border border-zinc-700 rounded-xl p-8 shadow-2xl">
          <h1 className="text-3xl font-orbitron text-casino-gold mb-8 border-b border-zinc-700 pb-4">MON PROFIL</h1>
          
          <div className="space-y-6 font-rajdhani text-lg">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 uppercase tracking-widest">Identifiant</span>
              <span className="text-white text-xl font-bold">{user.username}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 uppercase tracking-widest">Email</span>
              <span className="text-white">{user.email}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 uppercase tracking-widest">Rôle</span>
              <span className="text-blue-400 font-bold uppercase">{user.role}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-500 uppercase tracking-widest">Membre depuis</span>
              <span className="text-white">{user.joinDate}</span>
            </div>
            
            <div className="pt-8 flex flex-col sm:flex-row gap-4">
              <CasinoButton variant="metal" size="sm">Modifier mot de passe</CasinoButton>
              <CasinoButton variant="metal" size="sm">Modifier email</CasinoButton>
            </div>
          </div>
        </div>
      </div>
    </CasinoLayout>
  );
}
