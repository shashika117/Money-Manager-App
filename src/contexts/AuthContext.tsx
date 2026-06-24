import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────
export interface UserProfile {
  id:           string
  display_name: string    // "Husband" or "Wife"
  avatar_color: string    // hex colour for UI indicators
}

interface AuthContextValue {
  user:    User        | null
  session: Session     | null
  profile: UserProfile | null
  loading: boolean             // true while initial session is being resolved
  signIn:  (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ── Provider ──────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User        | null>(null)
  const [session, setSession] = useState<Session     | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch the profile row for a given user ID
  async function fetchProfile(userId: string): Promise<void> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_color')
      .eq('id', userId)
      .single()

    if (error) {
      console.warn('Profile not found:', error.message)
      return
    }
    setProfile(data as UserProfile)
  }

  
// Tracks which user ID we already have a profile loaded for.
  // Prevents re-fetching on every token refresh or tab focus event.
  const loadedProfileForId = useRef<string | null>(null)

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately on mount,
    // so getSession() + fetchProfile is not needed separately.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          // Only fetch profile if we haven't loaded it for this user yet
          if (loadedProfileForId.current !== session.user.id) {
            loadedProfileForId.current = session.user.id
            await fetchProfile(session.user.id)
          }
        } else {
          // User signed out — reset everything
          loadedProfileForId.current = null
          setProfile(null)
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])


  // ── Auth actions ────────────────────────────────────────────────
  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}