import { Navigate, Route, Routes } from 'react-router-dom';
import NavShell from './components/NavShell';
import AgentsPage from './pages/AgentsPage';
import ConversationsPage from './pages/ConversationsPage';
import EmotionInsightsPage from './pages/EmotionInsightsPage';
import ShowcasePage from './pages/ShowcasePage';
import TextAnalysisPage from './pages/TextAnalysisPage';
import VoiceAgentPage from './pages/VoiceAgentPage';

export default function App() {
  return (
    <NavShell>
      <Routes>
        <Route path="/" element={<VoiceAgentPage />} />
        <Route path="/emotion" element={<EmotionInsightsPage />} />
        <Route path="/text" element={<TextAnalysisPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/showcase" element={<ShowcasePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </NavShell>
  );
}
