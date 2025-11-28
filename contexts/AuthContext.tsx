
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { MOCK_USERS } from '../constants'; // Keeping for fallback/reference if needed

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Start as false so we don't block UI waiting for session check
  const [isLoading, setIsLoading] = useState(false);

  // Helper to fetch profile from 'profiles' table using the auth id
  const fetchProfile = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        // Map DB profile to App User
        const appUser: User = {
          id: data.id,
          name: data.name,
          email: data.email || email || '',
          role: data.role as UserRole,
          department: data.department,
          avatarUrl: data.avatar_url
        };
        setUser(appUser);
      } else {
        console.warn('Profile not found. Attempting to create default profile...');
        
        // Self-Healing: Create a default profile if one is missing
        const newProfile = {
          id: userId,
          email: email,
          name: 'Staff Member',
          role: 'staff',
          department: 'General'
        };

        const { error: insertError } = await supabase
          .from('profiles')
          .insert([newProfile]);

        if (!insertError) {
           setUser({
             id: userId,
             name: newProfile.name,
             email: newProfile.email || '',
             role: newProfile.role as UserRole,
             department: newProfile.department
           });
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  useEffect(() => {
    // HARD LOGOUT ON REFRESH / MOUNT
    // We explicitly sign out on load to prevent any "hooking" or stale session issues.
    const clearSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await supabase.auth.signOut();
        }
    };
    clearSession();

    // We only listen for SIGNED_OUT to clear local state immediately.
    // We DO NOT listen for SIGNED_IN to trigger fetches, to avoid race conditions with the login function.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password?: string): Promise<boolean> => {
    if (!password) {
        console.error("Password required");
        return false;
    }
    
    setIsLoading(true);
    try {
      // Ensure we start with a clean slate before attempting login
      await supabase.auth.signOut();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
          console.error("Supabase Login Error:", error.message);
          setIsLoading(false);
          return false;
      }
      
      if (data.session?.user) {
          await fetchProfile(data.session.user.id, email);
          setIsLoading(false);
          return true;
      }
    } catch (err) {
      console.error("Login exception:", err);
    }
    
    // Always ensure loading is turned off if we fall through
    setIsLoading(false);
    return false;
  };

  const logout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
