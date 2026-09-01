export interface AegisAuthUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  provider: 'google' | 'apple' | 'email' | 'guest';
  role: 'Driver' | 'RTO';
  isAnonymous?: boolean;
}

export interface UserProfileData {
  userId?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  emergencyContact1: { name: string; phone: string };
  emergencyContact2: { name: string; phone: string };
  autoReport: boolean;
  guardianNotifications: boolean;
  photoURL?: string;
  updatedAt?: string;
}

export const LOCAL_AUTH_STORAGE_KEY = 'aegis_auth_user';
export const LOCAL_PROFILE_STORAGE_KEY = 'aegis_user_profile';
