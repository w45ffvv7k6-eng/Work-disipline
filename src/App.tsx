import type { ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { AuthScreen, NewPasswordScreen } from './features/auth/AuthScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { ComingSoon } from './features/placeholder/ComingSoon';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { SessionEditorScreen } from './features/sessions/SessionEditorScreen';
import { SessionsScreen } from './features/sessions/SessionsScreen';
import { WorkoutSummaryScreen } from './features/summary/WorkoutSummaryScreen';
import { LiveWorkoutScreen } from './features/workout/LiveWorkoutScreen';
import { FeedbackProvider } from './ui/feedback';
import { ThemeSync } from './ui/ThemeSync';
import { WelcomeSplash } from './ui/WelcomeSplash';
import { DumbbellIcon, HistoryIcon, ListIcon, TemplateIcon, UserIcon } from './ui/icons';

const TABS = [
  { to: '/', label: 'Programme', icon: <DumbbellIcon />, end: true },
  { to: '/seances', label: 'Séances', icon: <TemplateIcon /> },
  { to: '/historique', label: 'Historique', icon: <HistoryIcon /> },
  { to: '/exercices', label: 'Exercices', icon: <ListIcon /> },
  { to: '/profil', label: 'Profil', icon: <UserIcon /> },
];

function TabBar() {
  const location = useLocation();
  // Pendant une séance, l'onglet « Séance » reste actif.
  const inWorkout = location.pathname.startsWith('/seance/') || location.pathname.startsWith('/bravo');
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => (isActive || (inWorkout && t.to === '/') ? 'active' : '')}
        >
          {t.icon}
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Sans compte connecté (quand les comptes sont activés), on affiche l'écran de connexion. */
function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return null;
  if (status === 'signedOut') return <AuthScreen />;
  if (status === 'recovery') return <NewPasswordScreen />;
  return <>{children}</>;
}

export function App() {
  return (
    <HashRouter>
      <FeedbackProvider>
        <AuthProvider>
          <AuthGate>
            <div className="app">
              <Routes>
                <Route path="/" element={<HomeScreen />} />
                <Route path="/seance/:id" element={<LiveWorkoutScreen />} />
                <Route
                  path="/historique"
                  element={
                    <ComingSoon
                      title="Historique"
                      subtitle="Tes séances passées, en détail"
                      icon={<HistoryIcon />}
                      step="Historique et graphiques"
                    />
                  }
                />
                <Route
                  path="/exercices"
                  element={
                    <ComingSoon
                      title="Exercices"
                      subtitle="Bibliothèque et courbes de progression"
                      icon={<ListIcon />}
                      step="Bibliothèque"
                    />
                  }
                />
                <Route path="/seances" element={<SessionsScreen />} />
                <Route path="/seances/:id" element={<SessionEditorScreen />} />
                <Route path="/bravo/:id" element={<WorkoutSummaryScreen />} />
                <Route path="/profil" element={<ProfileScreen />} />
                <Route path="*" element={<HomeScreen />} />
              </Routes>
              <TabBar />
            </div>
          </AuthGate>
          <WelcomeSplash />
          <ThemeSync />
        </AuthProvider>
      </FeedbackProvider>
    </HashRouter>
  );
}
