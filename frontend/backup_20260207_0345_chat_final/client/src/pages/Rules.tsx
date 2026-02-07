
import React from 'react';
import { CasinoLayout } from '@/components/layout/CasinoLayout';

export default function Rules() {
  return (
    <CasinoLayout>
      <div className="max-w-4xl mx-auto p-6 md:p-12 bg-black/80 min-h-screen text-zinc-300 font-rajdhani space-y-8">
        <h1 className="text-4xl font-orbitron text-casino-gold mb-8 border-b border-zinc-700 pb-4">RÈGLES DE L'EUROMILLIONS</h1>

        <section className="space-y-4">
            <h2 className="text-2xl font-orbitron text-white">PRINCIPE DU JEU</h2>
            <p>Pour jouer à EuroMillions, il vous suffit de cocher <strong>5 numéros</strong> (parmi 50) et <strong>2 étoiles</strong> (parmi 12).</p>
            <p>Le prix d'une grille simple est de <strong>2,50 €</strong>.</p>
        </section>

        <section className="space-y-4">
            <h2 className="text-2xl font-orbitron text-white">LES TIRAGES</h2>
            <p>Les tirages ont lieu deux fois par semaine :</p>
            <ul className="list-disc list-inside ml-4 text-white">
                <li>Le <strong>Mardi</strong> vers 21h05</li>
                <li>Le <strong>Vendredi</strong> vers 21h05</li>
            </ul>
        </section>

        <section className="space-y-4">
            <h2 className="text-2xl font-orbitron text-white">TABLEAU DES GAINS THÉORIQUES</h2>
            <div className="bg-zinc-900 border border-zinc-700 rounded p-4">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-zinc-500 border-b border-zinc-700">
                            <th className="text-left pb-2">Combinaison</th>
                            <th className="text-right pb-2">Gain estimé</th>
                        </tr>
                    </thead>
                    <tbody className="text-zinc-300">
                        <tr className="border-b border-zinc-800"><td className="py-2">5 numéros + 2 étoiles</td><td className="text-right text-casino-gold font-bold">JACKPOT (Min 17M€)</td></tr>
                        <tr className="border-b border-zinc-800"><td className="py-2">5 numéros + 1 étoile</td><td className="text-right">~ 200 000 €</td></tr>
                        <tr className="border-b border-zinc-800"><td className="py-2">5 numéros</td><td className="text-right">~ 20 000 €</td></tr>
                        <tr className="border-b border-zinc-800"><td className="py-2">4 numéros + 2 étoiles</td><td className="text-right">~ 1 500 €</td></tr>
                        <tr className="border-b border-zinc-800"><td className="py-2">4 numéros + 1 étoile</td><td className="text-right">~ 100 €</td></tr>
                        <tr><td className="py-2">2 numéros</td><td className="text-right">~ 4 €</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
      </div>
    </CasinoLayout>
  );
}
