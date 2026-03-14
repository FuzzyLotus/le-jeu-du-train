export interface GeocodeResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

export interface UserPreferences {
  isPublicProfile: boolean;
  showTripsOnLeaderboard: boolean;
  allowFriendRequests: boolean;
  showFullTripDetails?: boolean; // Show start/end addresses to others
  showTripHistory?: boolean; // Show list of past trips to others
  showStats?: boolean; // Show statistics (total km, points, etc.) to others
}

export interface User {
  id?: number;
  username: string;
  displayName: string;
  passwordHash?: string;
  points: number;
  totalEarned: number;
  tripCount: number;
  streak: number;
  hasLost: boolean;
  longestTripKm: number;
  totalDistanceKm: number;
  maxCrossingsInTrip: number;
  highestScore?: number;
  createdAt: number;
  isAdmin?: boolean;
  homeLocation?: GeocodeResult;
  preferences?: UserPreferences;
  achievements?: string[];
  /** Global rank by points (1 = first). */
  pointsRank?: number;
  /** Global rank by trip count (1 = first). */
  tripsRank?: number;
}

export interface Trip {
  id?: number;
  userId: number;
  routeName: string;
  distanceKm: number;
  crossingsCount: number;
  success: boolean;
  date: number;
  hasBridge?: boolean;
  hasTunnel?: boolean;
  maxElevation?: number;
  minElevation?: number;
  maxBridgeLength?: number;
  startCountry?: string;
  endCountry?: string;
  startIsland?: string;
  endIsland?: string;
}

export interface Achievement {
  id?: number;
  userId: number;
  achievementId: string;
  unlockedAt: number;
}

export type FeedbackType = 'bug' | 'feedback';
export type FeedbackStatus = 'new' | 'pending' | 'in_progress' | 'resolved' | 'rejected' | 'completed' | 'closed';

export interface FeedbackReply {
  senderId: number;
  isAdmin: boolean;
  message: string;
  createdAt: number;
}

export interface Feedback {
  id?: number;
  userId: number;
  type: FeedbackType;
  message: string;
  status: FeedbackStatus;
  createdAt: number;
  updatedAt: number;
  replies?: FeedbackReply[];
  githubIssueNumber?: number;
  githubIssueUrl?: string;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id?: number;
  senderId: number;
  receiverId: number;
  status: FriendRequestStatus;
  createdAt: number;
}
