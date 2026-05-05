import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LogOut,
  Mail,
  ShieldCheck,
  UserCircle,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import styles from './ProfilePage.module.scss'

type ToastState = {
  message: string
  type: 'success' | 'error'
}

const getInitials = (email: string): string => {
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase()
}

const formatDate = (iso: string | undefined): string => {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error || !data.user) {
          setIsLoading(false)
          return
        }
        setUser(data.user)
        setIsLoading(false)
      })
      .catch(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleSignOut = async () => {
    if (!supabase || isSigningOut) return
    try {
      setIsSigningOut(true)
      await supabase.auth.signOut()
    } finally {
      setIsSigningOut(false)
      void navigate('/login', { replace: true })
    }
  }

  const handleResetPassword = async () => {
    if (!supabase || !user?.email) return
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) {
        setToast({ message: `Erro: ${error.message}`, type: 'error' })
        return
      }
      setToast({ message: 'Email de redefinição enviado!', type: 'success' })
    } catch {
      setToast({ message: 'Erro ao solicitar redefinição.', type: 'error' })
    }
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <LoaderCircle size={22} className={styles.spinner} />
          <span>Carregando perfil...</span>
        </div>
      </div>
    )
  }

  const email = user?.email ?? 'usuario@email.com'
  const provider =
    user?.app_metadata?.provider === 'google'
      ? 'Google'
      : user?.app_metadata?.provider === 'email'
        ? 'Email / Senha'
        : (user?.app_metadata?.provider ?? '—')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Perfil</h1>
        <p className={styles.subtitle}>Informações da sua conta e sessão ativa.</p>
      </header>

      {/* Avatar Card */}
      <div className={styles.avatarCard}>
        <div className={styles.avatar}>{getInitials(email)}</div>
        <span className={styles.avatarName}>{email.split('@')[0]}</span>
        <span className={styles.avatarEmail}>{email}</span>
        <span className={styles.avatarBadge}>
          <CheckCircle2 size={14} />
          Conta ativa
        </span>
      </div>

      {/* Account Info */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <UserCircle size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Informações da conta</h2>
            <p className={styles.sectionDescription}>Dados vinculados à sua autenticação.</p>
          </div>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>
            <Mail size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Email
          </span>
          <span className={styles.infoValue}>{email}</span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>
            <ShieldCheck size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Provedor
          </span>
          <span className={styles.infoValue}>{provider}</span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>
            <KeyRound size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            ID do usuário
          </span>
          <span className={`${styles.infoValue} ${styles.infoValueMono}`}>{user?.id ?? '—'}</span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>
            <Calendar size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Criado em
          </span>
          <span className={styles.infoValue}>{formatDate(user?.created_at)}</span>
        </div>

        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>
            <Calendar size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Último login
          </span>
          <span className={styles.infoValue}>{formatDate(user?.last_sign_in_at)}</span>
        </div>
      </section>

      {/* Actions */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <KeyRound size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Ações da conta</h2>
            <p className={styles.sectionDescription}>Segurança e acesso.</p>
          </div>
        </div>

        <div className={styles.infoRow}>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => void handleResetPassword()}
            >
              <KeyRound size={16} />
              <span>Redefinir senha</span>
            </button>

            <button
              type="button"
              className={`${styles.actionButton} ${styles.dangerButton}`}
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
            >
              <LogOut size={16} />
              <span>{isSigningOut ? 'Saindo...' : 'Sair da conta'}</span>
            </button>
          </div>
        </div>
      </section>

      {toast && (
        <div
          className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
