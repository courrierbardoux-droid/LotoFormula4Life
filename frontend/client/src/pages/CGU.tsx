
import React from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';

export default function CGU() {
  return (
    <CasinoLayout>
      <div className="max-w-4xl mx-auto p-6 md:p-12 bg-black/80 min-h-screen text-zinc-300 font-rajdhani">
        <h1 className="text-4xl font-orbitron text-casino-gold mb-8 border-b border-zinc-700 pb-4">CONDITIONS GÉNÉRALES D'UTILISATION</h1>
        
        <div className="prose prose-invert max-w-none">
            <p className="italic text-zinc-500">CGU en cours de rédaction. À compléter.</p>
            
            <h3 className="text-white mt-8">1. Objet</h3>
            <p>Les présentes CGU régissent l'utilisation du service LotoFormula4Life...</p>

            <h3 className="text-white mt-8">2. Responsabilité</h3>
            <p>LotoFormula4Life est un outil d'aide à la décision basé sur des statistiques. Le hasard reste un facteur déterminant. L'éditeur ne saurait être tenu responsable des pertes financières...</p>
        </div>
      </div>
    </CasinoLayout>
  );
}
