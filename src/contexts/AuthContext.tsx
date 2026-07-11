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

  // Tracks which user ID we already have a profile loaded for.
  // Prevents re-fetching on every token refresh or tab focus event.
  const loadedProfileForId = useRef<string | null>(null)

  // Fetch the profile row for a given user ID.
  // IMPORTANT: this must NEVER be awaited from inside the
  // onAuthStateChange callback — see the note below.
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

  useEffect(() => {
    // ════════════════════════════════════════════════════════════════
    // CRITICAL — DO NOT make this callback `async`, and DO NOT `await`
    // any Supabase call inside it.
    //
    // onAuthStateChange runs SYNCHRONOUSLY while the auth library holds
    // its internal lock. Awaiting another Supabase call (e.g. a query on
    // `profiles`) from inside deadlocks the client: the lock is never
    // released, the next Supabase call hangs forever, and `loading` is
    // never cleared — the app sits on the loading screen until a manual
    // browser reload. This is a known supabase-js bug (auth-js #762) and
    // was the cause of the "must hit Reload to sign in" behaviour.
    //
    // The fix (per Supabase's own guidance): keep the callback sync, and
    // defer any Supabase work to a setTimeout(..., 0) so it runs AFTER
    // the callback returns and the lock has been released.
    // ════════════════════════════════════════════════════════════════
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setUser(nextSession?.user ?? null)

        if (nextSession?.user) {
          const uid = nextSession.user.id

          // Only fetch the profile once per user.
          if (loadedProfileForId.current !== uid) {
            loadedProfileForId.current = uid
            // Deferred — runs after the callback completes (no deadlock).
            setTimeout(() => { void fetchProfile(uid) }, 0)
          }
        } else {
          // Signed out — reset everything.
          loadedProfileForId.current = null
          setProfile(null)
        }

        // Resolve the app shell immediately. The profile streams in a
        // moment later; the UI already handles `profile == null`.
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
