
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

// Protected Route Wrapper
function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();

  if (!user) {
    setTimeout(() => setLocation("/"), 0);
    return null;
  }

  if (adminOnly && user.role !== 'admin') {
    setTimeout(() => setLocation("/dashboard"), 0);
    return null;
  }

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
      
      <Route path="/rules" component={Rules} />
      <Route path="/cgu" component={CGU} />
      
      <Route path="/subscribers">
        <ProtectedRoute component={SubscriberManagement} adminOnly />
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
