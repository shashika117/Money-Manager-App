import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

// ── Validation schema ─────────────────────────────────────────────
const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormData = z.infer<typeof schema>

// ── Component ─────────────────────────────────────────────────────
export default function LoginPage() {
  const { user, signIn } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  // Already logged in — go to dashboard
  if (user) return <Navigate to="/" replace />

  async function onSubmit(data: FormData) {
    setServerError(null)
    try {
      await signIn(data.email, data.password)
      // Navigation happens automatically via onAuthStateChange → ProtectedRoute
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed.'
      // Provide a friendlier message for wrong credentials
      setServerError(
        msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')
          ? 'Incorrect email or password.'
          : msg
      )
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy px-5 py-10">

      {/* ── Logo / Brand ── */}
      <div className="mb-10 flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green/15 ring-1 ring-green/30">
          <span className="text-3xl">

          {/* LOGO DESIGN */}
          <svg
              width={36}
              height={36}
              viewBox="26 28 148 148"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
            <linearGradient id="mGradient" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#00E5FF" />   <stop offset="100%" stop-color="#FFFFFF" /> </linearGradient>
            <linearGradient id="glowFilter" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#00E5FF" stop-opacity="0.12" />
              <stop offset="100%" stop-color="#00E5FF" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="M 68 145 Q 100 102 132 145 Z" fill="url(#glowFilter)" />
          <path 
            d="M58 145 
               C58 115, 62 85, 76 85 
               C90 85, 93 118, 100 118 
               C107 118, 124 60, 140 60 
               C146 60, 144 105, 144 145" 
            fill="none" 
            stroke="#00E5FF" 
            stroke-width="16" stroke-linecap="round" 
            stroke-linejoin="round" 
          />
          <path 
            d="M58 145 
               C58 115, 62 85, 76 85 
               C90 85, 93 118, 100 118 
               C107 118, 124 60, 140 60 
               C146 60, 144 105, 144 145" 
            fill="none" 
            stroke="url(#mGradient)" 
            stroke-width="16" 
            stroke-linecap="round" 
            stroke-linejoin="round" 
          />
          <circle cx="140" cy="60" r="7.5" fill="none" stroke="#00E5FF" stroke-width="3" />
          <circle cx="140" cy="60" r="7" fill="none" stroke="url(#mGradient)" stroke-width="4" />
        </svg>



          </span>
        </div>
        <h1 className="font-sora text-2xl font-bold tracking-tight text-white">
          Money Manager
        </h1>
        <p className="font-dm text-sm text-soft">
          Your private family finance hub
        </p>
      </div>

      {/* ── Card ── */}
      <div className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-xl">

        <h2 className="mb-6 font-sora text-lg font-semibold text-white">
          Sign in
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              {...register('email')}
              className={cn(
                'w-full rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white',
                'placeholder:text-muted outline-none transition-colors',
                'focus:border-green focus:ring-1 focus:ring-green/30',
                errors.email ? 'border-red' : 'border-line'
              )}
            />
            {errors.email && (
              <p className="mt-1.5 font-dm text-xs text-red">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block font-dm text-xs font-medium uppercase tracking-wider text-soft"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className={cn(
                'w-full rounded-xl border bg-panel px-4 py-3 font-dm text-sm text-white',
                'placeholder:text-muted outline-none transition-colors',
                'focus:border-green focus:ring-1 focus:ring-green/30',
                errors.password ? 'border-red' : 'border-line'
              )}
            />
            {errors.password && (
              <p className="mt-1.5 font-dm text-xs text-red">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Server-side error */}
          {serverError && (
            <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3">
              <p className="font-dm text-sm text-red">{serverError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'mt-2 w-full rounded-xl py-3.5 font-sora text-sm font-semibold text-white',
              'bg-green transition-opacity active:scale-95',
              isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
            )}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Footer note */}
        <p className="mt-6 text-center font-dm text-xs text-muted">
          Private access · Husband &amp; Wife only
        </p>
      </div>
    </div>
  )
}