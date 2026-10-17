import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { HomeScreen } from './features/home/HomeScreen';
import { ComingSoon } from './features/placeholder/ComingSoon';
import { LiveWorkoutScreen } from './features/workout/LiveWorkoutScreen';
import { FeedbackProvider } from './ui/feedback';
import { DumbbellIcon, HistoryIcon, ListIcon, TemplateIcon, UserIcon } from './ui/icons';

const TABS = [
  { to: '/', label: 'Séance', icon: <DumbbellIcon />, end: true },
  { to: '/historique', label: 'Historique', icon: <HistoryIcon /> },
  { to: '/exercices', label: 'Exercices', icon: <ListIcon /> },
  { to: '/modeles', label: 'Modèles', icon: <TemplateIcon /> },
  { to: '/profil', label: 'Profil', icon: <UserIcon /> },
];

function TabBar() {
  const location = useLocation();
  // Pendant une séance, l'onglet « Séance » reste actif.
  const inWorkout = location.pathname.startsWith('/seance');
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

export function App() {
  return (
    <HashRouter>
      <FeedbackProvider>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/seance/:id" element={<LiveWorkoutScreen />} />
            <Route path="/historique" element={<ComingSoon title="Historique" step="Historique et graphiques" />} />
            <Route path="/exercices" element={<ComingSoon title="Exercices" step="Bibliothèque" />} />
            <Route path="/modeles" element={<ComingSoon title="Modèles" step="Modèles" />} />
            <Route path="/profil" element={<ComingSoon title="Profil" step="Profil et suivi corporel" />} />
            <Route path="*" element={<HomeScreen />} />
          </Routes>
          <TabBar />
        </div>
      </FeedbackProvider>
    </HashRouter>
  );
}
