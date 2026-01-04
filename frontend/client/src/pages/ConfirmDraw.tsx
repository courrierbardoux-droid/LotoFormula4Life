import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail, Gift } from 'lucide-react';

export default function ConfirmDraw() {
  const params = useParams();
  const token = params.token as string;
  const [, setLocation] = useLocation();
  
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'confirming' | 'success' | 'error'>('loading');
  const [gridCount, setGridCount] = useState(0);
  const [message, setMessage] = useState('');

  // Vérifier le token au chargement
  useEffect(() => {
    const checkToken = async () => {
      try {
        const response = await fetch(`/api/draws/confirm/${token}`);
        const data = await response.json();
        
        if (data.valid) {
          setStatus('valid');
          setGridCount(data.gridCount);
        } else {
          setStatus('invalid');
          setMessage(data.error || 'Lien invalide ou expiré');
        }
      } catch (error) {
        setStatus('invalid');
        setMessage('Erreur de connexion');
      }
    };

    if (token) {
      checkToken();
    }
  }, [token]);

  // Confirmer et recevoir les numéros
  const handleConfirm = async () => {
    setStatus('confirming');
    
    try {
      const response = await fetch(`/api/draws/confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setStatus('success');
        setGridCount(data.gridCount);
      } else {
        setStatus('error');
        setMessage(data.error || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Erreur de connexion');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-casino-gold font-orbitron tracking-wider">
            🎰 LOTOFORMULA4LIFE
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Statistiques & Prédictibilités EuroMillions</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
          
          {/* Loading */}
          {status === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 text-casino-gold animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Vérification en cours...</p>
            </div>
          )}

          {/* Invalid Token */}
          {status === 'invalid' && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-400 mb-2">Lien invalide</h2>
              <p className="text-zinc-500 mb-6">{message}</p>
              <Button 
                onClick={() => setLocation('/')}
                className="bg-zinc-700 hover:bg-zinc-600"
              >
                Retour à l'accueil
              </Button>
            </div>
          )}

          {/* Valid - Waiting Confirmation */}
          {status === 'valid' && (
            <div className="text-center py-4">
              <Gift className="w-16 h-16 text-casino-gold mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">
                {gridCount} grille{gridCount > 1 ? 's' : ''} prête{gridCount > 1 ? 's' : ''} !
              </h2>
              <p className="text-zinc-400 mb-6">
                Cliquez ci-dessous pour recevoir vos numéros par email et les sauvegarder dans votre historique.
              </p>
              
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6 text-left">
                <p className="text-zinc-300 text-sm leading-relaxed">
                  <span className="text-casino-gold font-bold">📌 Rappel :</span><br />
                  Notre site ne prétend pas prédire l'avenir. Nous vous proposons des numéros sélectionnés selon vos réglages et notre approche statistique.
                </p>
                <p className="text-zinc-400 text-xs mt-3 leading-relaxed">
                  <span className="text-green-400 font-bold">💚</span> En retour, je ne vous demande que votre gratitude et vos remerciements. Si la chance vous sourit et que votre gain vous inspire générosité... à votre bon cœur ! Tout geste de reconnaissance, qu'il soit symbolique ou fiduciaire, sera accueilli comme un don et une grâce. Aucun engagement, aucune obligation.
                </p>
              </div>

              <Button 
                onClick={handleConfirm}
                className="w-full bg-gradient-to-r from-casino-gold to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold py-6 text-lg"
              >
                <Mail className="w-5 h-5 mr-2" />
                RECEVOIR MES NUMÉROS
              </Button>
            </div>
          )}

          {/* Confirming */}
          {status === 'confirming' && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 text-casino-gold animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Envoi en cours...</p>
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-green-400 mb-2">Envoyé avec succès !</h2>
              <p className="text-zinc-400 mb-2">
                {gridCount} grille{gridCount > 1 ? 's' : ''} envoyée{gridCount > 1 ? 's' : ''} par email.
              </p>
              <p className="text-zinc-500 text-sm mb-6">
                Vos numéros ont également été sauvegardés dans "Mes Grilles Jouées".
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={() => setLocation('/my-grids')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Voir mes grilles
                </Button>
                <Button 
                  onClick={() => setLocation('/')}
                  variant="outline"
                  className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                >
                  Retour à l'accueil
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="text-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-400 mb-2">Erreur</h2>
              <p className="text-zinc-500 mb-6">{message}</p>
              <Button 
                onClick={() => setLocation('/')}
                className="bg-zinc-700 hover:bg-zinc-600"
              >
                Retour à l'accueil
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs mt-6">
          Bonne chance ! 🍀
        </p>
      </div>
    </div>
  );
}

