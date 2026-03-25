import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/lib/supabase";
import type { AppUser } from "@/types";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  appUser: AppUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  checkAdminStatus: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      appUser: null,
      isAdmin: false,
      isLoading: false,
      isInitializing: true,
      error: null,

      initialize: async () => {
        try {
          set({ isInitializing: true, error: null });

          // Get current session
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();

          if (sessionError) throw sessionError;

          if (session?.user) {
            set({ user: session.user, session });

            // Check if user is admin
            const isAdmin = await get().checkAdminStatus();

            if (!isAdmin) {
              // Sign out non-admin users
              await supabase.auth.signOut();
              set({
                user: null,
                session: null,
                appUser: null,
                isAdmin: false,
                error: "Access denied. Admin privileges required.",
              });
            }
          }
        } catch (error) {
          console.error("Auth initialization error:", error);
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to initialize auth",
          });
        } finally {
          set({ isInitializing: false });
        }
      },

      signIn: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          const { data, error: signInError } =
            await supabase.auth.signInWithPassword({
              email,
              password,
            });

          if (signInError) throw signInError;

          if (!data.user || !data.session) {
            throw new Error("Sign in failed");
          }

          set({ user: data.user, session: data.session });

          // Check if user is admin
          const isAdmin = await get().checkAdminStatus();

          if (!isAdmin) {
            // Sign out non-admin users
            await supabase.auth.signOut();
            set({
              user: null,
              session: null,
              appUser: null,
              isAdmin: false,
              error: "Access denied. Admin privileges required.",
            });
            return {
              success: false,
              error: "Access denied. Admin privileges required.",
            };
          }

          return { success: true };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Sign in failed";
          set({ error: message });
          return { success: false, error: message };
        } finally {
          set({ isLoading: false });
        }
      },

      signOut: async () => {
        try {
          set({ isLoading: true });
          await supabase.auth.signOut();
          set({
            user: null,
            session: null,
            appUser: null,
            isAdmin: false,
            error: null,
          });
        } catch (error) {
          console.error("Sign out error:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      checkAdminStatus: async () => {
        const { user } = get();
        if (!user) return false;

        try {
          // Fetch AppUser record with role
          const { data, error } = await supabase
            .from("AppUser")
            .select("*")
            .eq("authUserID", user.id)
            .single();

          if (error) {
            console.error("Error fetching AppUser:", error);
            return false;
          }

          const appUser = data as AppUser;
          const isAdmin =
            appUser?.role === "admin" || appUser?.role === "super_admin";
          set({ appUser, isAdmin });
          return isAdmin;
        } catch (error) {
          console.error("Error checking admin status:", error);
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "pdc-admin-auth",
      partialize: () => ({
        // Only persist minimal data, re-verify on load
      }),
    }
  )
);

// Set up auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    useAuthStore.setState({
      user: null,
      session: null,
      appUser: null,
      isAdmin: false,
    });
  } else if (session?.user) {
    useAuthStore.setState({ user: session.user, session });
    useAuthStore.getState().checkAdminStatus();
  }
});
