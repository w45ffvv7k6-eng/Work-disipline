import type { ReactNode } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthProvider';
import { AuthScreen, NewPasswordScreen } from './features/auth/AuthScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { PersonGate } from './features/people/PersonGate';
import { ExerciseDetailScreen } from './features/exercises/ExerciseDetailScreen';
import { ExercisesScreen } from './features/exercises/ExercisesScreen';
import { HistoryDetailScreen } from './features/history/HistoryDetailScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { SessionEditorScreen } from './features/sessions/SessionEditorScreen';
import { SessionsScreen } from './features/sessions/SessionsScreen';
import { WorkoutSummaryScreen } from './features/summary/WorkoutSummaryScreen';
import { LiveWorkoutScreen } from './features/workout/LiveWorkoutScreen';
import { FeedbackProvider } from './ui/feedback';
import { AppBackground } from './ui/AppBackground';
import { ThemeSync } from './ui/ThemeSync';
import { WelcomeSplash } from './ui/WelcomeSplash';
import { k, t as translate } from './i18n';
import { LanguageProvider, useLanguage } from './i18n/react';
import { DumbbellIcon, HistoryIcon, ListIcon, TemplateIcon, UserIcon } from './ui/icons';

const TABS = [
  { to: '/', label: k('Programme'), icon: <DumbbellIcon />, end: true },
  { to: '/seances', label: k('Séances'), icon: <TemplateIcon /> },
  { to: '/historique', label: k('Historique'), icon: <HistoryIcon /> },
  { to: '/exercices', label: k('Exercices'), icon: <ListIcon /> },
  { to: '/profil', label: k('Profil'), icon: <UserIcon /> },
];

/** Chaque changement d'écran apparaît en fondu (animation rejouée à chaque nouvelle adresse). */
function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      {children}
    </div>
  );
}

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
          {translate(t.label)}
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

/** Au changement de langue, tout l'intérieur de l'appli est redessiné dans la nouvelle langue. */
function TranslatedApp({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  return (
    <div className="app" key={lang}>
      {children}
    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <HashRouter>
        <FeedbackProvider>
          <AuthProvider>
            <PersonGate welcome={<WelcomeSplash />}>
              <AuthGate>
                <AppBackground />
                <TranslatedApp>
                  <PageTransition>
                    <Routes>
                      <Route path="/" element={<HomeScreen />} />
                      <Route path="/seance/:id" element={<LiveWorkoutScreen />} />
                      <Route path="/historique" element={<HistoryScreen />} />
                      <Route path="/historique/:id" element={<HistoryDetailScreen />} />
                      <Route path="/exercices" element={<ExercisesScreen />} />
                      <Route path="/exercices/:id" element={<ExerciseDetailScreen />} />
                      <Route path="/seances" element={<SessionsScreen />} />
                      <Route path="/seances/:id" element={<SessionEditorScreen />} />
                      <Route path="/bravo/:id" element={<WorkoutSummaryScreen />} />
                      <Route path="/profil" element={<ProfileScreen />} />
                      <Route path="*" element={<HomeScreen />} />
                    </Routes>
                  </PageTransition>
                  <TabBar />
                </TranslatedApp>
              </AuthGate>
            </PersonGate>
            <ThemeSync />
          </AuthProvider>
        </FeedbackProvider>
      </HashRouter>
    </LanguageProvider>
  );
}
