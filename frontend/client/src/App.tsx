
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider, useUser } from "@/lib/UserContext";
import { Navigation } from "@/components/layout/Navigation";

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Console from "@/pages/Console"; // New unified console
import Presentation from "@/pages/Presentation";
import Profile from "@/pages/Profile";
import History from "@/pages/History";
import MyGrids from "@/pages/MyGrids";
import Rules from "@/pages/Rules";
import CGU from "@/pages/CGU";
import SubscriberManagement from "@/pages/SubscriberManagement";
import SubscribersRedirect from "@/pages/SubscribersRedirect";
import UserDetails from "@/pages/UserDetails";
import ConfirmDraw from "@/pages/ConfirmDraw";
import PopupEmailManagement from "@/pages/PopupEmailManagement";
import PopupEmailManagementRedirect from "@/pages/PopupEmailManagementRedirect";
import Settings from "@/pages/Settings";
import SettingsPools from "@/pages/SettingsPools";
import SettingsWindows from "@/pages/SettingsWindows";
import UserActivityHistory from "@/pages/UserActivityHistory";

// Protected Route Wrapper
function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  console.log('[ProtectedRoute] ÉTAPE 1: Vérification - isLoading:', isLoading, 'user:', user?.username || 'null', 'role:', user?.role || 'null');

  // ÉTAPE 2: Attendre que le chargement de la session soit terminé avant de vérifier
  if (isLoading) {
    console.log('[ProtectedRoute] ÉTAPE 2: Le chargement est en cours, affichage écran de chargement...');
    // Pause pour observer
    setTimeout(() => {
      console.log('[ProtectedRoute] ÉTAPE 2 (après pause): Toujours en chargement...');
    }, 100);
    
    // Afficher un écran de chargement pendant la vérification
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-casino-gold mb-4"></div>
          <p className="text-xl font-orbitron text-white tracking-widest">CHARGEMENT...</p>
        </div>
      </div>
    );
  }

  // ÉTAPE 3: Maintenant que le chargement est terminé, vérifier l'utilisateur
  console.log('[ProtectedRoute] ÉTAPE 3: Le chargement est terminé, vérification de l\'utilisateur...');
  setTimeout(() => {
    console.log('[ProtectedRoute] ÉTAPE 3 (après pause): Vérification user... user existe?', !!user);
  }, 100);

  if (!user) {
    console.log('[ProtectedRoute] ÉTAPE 4: Utilisateur non trouvé, redirection vers /...');
    setTimeout(() => {
      console.log('[ProtectedRoute] ÉTAPE 4 (exécution): Redirection vers /');
      setLocation("/");
    }, 100);
    return null;
  }

  console.log('[ProtectedRoute] ÉTAPE 5: Utilisateur trouvé:', user.username, 'role:', user.role);
  
  if (adminOnly && user.role !== 'admin') {
    console.log('[ProtectedRoute] ÉTAPE 6: Accès admin requis mais utilisateur n\'est pas admin, redirection vers /dashboard...');
    setTimeout(() => {
      console.log('[ProtectedRoute] ÉTAPE 6 (exécution): Redirection vers /dashboard');
      setLocation("/dashboard");
    }, 100);
    return null;
  }

  console.log('[ProtectedRoute] ÉTAPE 7: Tout est OK, affichage du composant...');
  setTimeout(() => {
    console.log('[ProtectedRoute] ÉTAPE 7 (exécution): Composant affiché');
  }, 100);

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      
      {/* The main dashboard/console is shared but adapts to role */}
      <Route path="/dashboard">
        <ProtectedRoute component={Console} />
      </Route>
      <Route path="/admin">
         {/* Alias for dashboard but maybe we force admin check if user tries to access /admin directly */}
         <ProtectedRoute component={Console} />
      </Route>

      <Route path="/presentation" component={Presentation} />
      
      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>
      
      <Route path="/history" component={History} />
      
      <Route path="/my-grids">
        <ProtectedRoute component={MyGrids} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>

      <Route path="/settings/pools">
        <ProtectedRoute component={SettingsPools} />
      </Route>

      <Route path="/settings/windows">
        <ProtectedRoute component={SettingsWindows} />
      </Route>

      <Route path="/settings/popups-emails">
        <ProtectedRoute component={PopupEmailManagement} adminOnly />
      </Route>

      <Route path="/settings/users">
        <ProtectedRoute component={SubscriberManagement} adminOnly />
      </Route>

      <Route path="/settings/users/history">
        <ProtectedRoute component={UserActivityHistory} adminOnly />
      </Route>
      
      <Route path="/rules" component={Rules} />
      <Route path="/cgu" component={CGU} />
      
      <Route path="/subscribers">
        <ProtectedRoute component={SubscribersRedirect} adminOnly />
      </Route>
      
      <Route path="/popup-email-management">
        <ProtectedRoute component={PopupEmailManagementRedirect} adminOnly />
      </Route>
      
      {/* Page détails utilisateur (admin only) */}
      <Route path="/user/:userId">
        <ProtectedRoute component={UserDetails} adminOnly />
      </Route>

      {/* Page de confirmation pour recevoir les numéros par email */}
      <Route path="/confirm-draw/:token" component={ConfirmDraw} />

      {/* Courbes analyse fenêtre longue (HTML statique dans public/data) */}
      <Route path="/fenetre-longue-courbes">
        <iframe
          src="/data/fenetre-longue-courbes.html"
          className="fixed inset-0 w-full h-full border-0"
          title="Fenêtre longue Fréquence – Courbes"
        />
      </Route>
      <Route path="/fenetre-courte-courbes">
        <iframe
          src="/data/fenetre-courte-courbes.html"
          className="fixed inset-0 w-full h-full border-0"
          title="Fenêtre courte – Courbes"
        />
      </Route>
      <Route path="/fenetre-tendance-courbes">
        <iframe
          src="/data/fenetre-tendance-courbes.html"
          className="fixed inset-0 w-full h-full border-0"
          title="Fenêtre Tendance – Courbes"
        />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <Navigation />
          <Router />
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
