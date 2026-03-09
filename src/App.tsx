/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from './components/ToastContainer';
import { MainLayout } from './components/layout/MainLayout';
import { useAuthStore } from './store/useAuthStore';
import { LoginScreen } from './screens/LoginScreen';
import { SignupScreen } from './screens/SignupScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { PrivacyPolicyScreen } from './screens/PrivacyPolicyScreen';
import { HomeScreen } from './screens/HomeScreen';
import { TripPlannerScreen } from './screens/TripPlannerScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { AdminScreen } from './screens/AdminScreen';
import { FeedbackScreen } from './screens/FeedbackScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { PublicProfileScreen } from './screens/PublicProfileScreen';
import { FriendsScreen } from './screens/FriendsScreen';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isLoading = useAuthStore((state) => state.isLoading);
  
  if (isLoading) return <div>Loading...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <PwaInstallPrompt />
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/privacy" element={<PrivacyPolicyScreen />} />
        
        {/* Main App Layout */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/planner" element={<TripPlannerScreen />} />
          <Route path="/leaderboard" element={<LeaderboardScreen />} />
          <Route path="/achievements" element={<AchievementsScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/feedback" element={<FeedbackScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/profile/:userId" element={<PublicProfileScreen />} />
          <Route path="/profile/me" element={<PublicProfileScreen isMe />} />
          <Route path="/friends" element={<FriendsScreen />} />
        </Route>

        {/* Admin Route (Standalone) */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminScreen />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
