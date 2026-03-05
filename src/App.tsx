/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from './components/ToastContainer';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/privacy" element={<PrivacyPolicyScreen />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <HomeScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/planner" 
          element={
            <ProtectedRoute>
              <TripPlannerScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/leaderboard" 
          element={
            <ProtectedRoute>
              <LeaderboardScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/achievements" 
          element={
            <ProtectedRoute>
              <AchievementsScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/history" 
          element={
            <ProtectedRoute>
              <HistoryScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <AdminScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/feedback" 
          element={
            <ProtectedRoute>
              <FeedbackScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <SettingsScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile/:userId" 
          element={
            <ProtectedRoute>
              <PublicProfileScreen />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/friends" 
          element={
            <ProtectedRoute>
              <FriendsScreen />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
