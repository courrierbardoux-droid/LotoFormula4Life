import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';

export default function ConfirmDraw() {
  const [, params] = useRoute('/confirm-draw/:token');
  const token = params?.token;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Token manquant');
      return;
    }

    // Appeler l'API backend pour envoyer l'email2
    const sendEmail2 = async () => {
      try {
        console.log('[ConfirmDraw] Appel API pour envoyer email2 avec token:', token);
        const response = await fetch(`/api/draws/confirm/${token}`, {
          method: 'GET',
          credentials: 'include',
        });

        console.log('[ConfirmDraw] Réponse API:', response.status, response.statusText);

        if (response.status === 204 || response.ok) {
          setStatus('success');
          setMessage('Vos numéros ont été envoyés par email !');
        } else {
          setStatus('error');
          setMessage('Erreur lors de l\'envoi. Veuillez réessayer.');
        }
      } catch (error) {
        console.error('[ConfirmDraw] Erreur:', error);
        setStatus('error');
        setMessage('Erreur de connexion. Veuillez réessayer.');
      }
    };

    sendEmail2();
  }, [token]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0a0a0a] to-[#1a1a1a] flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border-2 border-casino-gold rounded-xl p-8 max-w-md w-full text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-casino-gold mb-4"></div>
            <h1 className="text-2xl font-orbitron text-casino-gold mb-4 tracking-widest">
              ENVOI EN COURS...
            </h1>
            <p className="text-zinc-300">Préparation de vos numéros...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-orbitron text-green-500 mb-4 tracking-widest">
              EMAIL ENVOYÉ !
            </h1>
            <p className="text-zinc-300 mb-6">{message}</p>
            <p className="text-sm text-zinc-500">
              Vérifiez votre boîte de réception (et vos spams).
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-orbitron text-red-500 mb-4 tracking-widest">
              ERREUR
            </h1>
            <p className="text-zinc-300 mb-6">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
