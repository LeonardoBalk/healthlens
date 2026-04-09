import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export default function RequireAuth() {
  const location = useLocation()
  const [status, setStatus] = useState<AuthStatus>(() => {
    return supabase ? 'loading' : 'unauthenticated'
  })

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return
        setStatus(data.session ? 'authenticated' : 'unauthenticated')
      })
      .catch(() => {
        if (!isMounted) return
        setStatus('unauthenticated')
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setStatus(session ? 'authenticated' : 'unauthenticated')
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (status === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-color, #d9d9d9)',
          background: 'var(--bg-color, #0e1018)',
          gap: '0.5rem',
        }}
      >
        <LoaderCircle size={22} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Verificando sessao...</span>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
