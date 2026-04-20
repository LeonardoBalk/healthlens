import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, House, LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button/Button'
import { Logo } from '@/components/ui/Logo/Logo'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import styles from './LoginPage.module.scss'

type ToastState = {
  message: string
  type: 'success' | 'error'
}

const DASHBOARD_PATH = '/datasets'

type AuthMode = 'login' | 'signup'

function GoogleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.805 12.23c0-.76-.068-1.49-.195-2.19H12v4.14h5.495a4.695 4.695 0 0 1-2.038 3.08v2.55h3.294c1.926-1.77 3.054-4.37 3.054-7.58Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.963-.9 6.617-2.44l-3.294-2.55c-.914.61-2.08.97-3.323.97-2.555 0-4.72-1.72-5.495-4.03H3.1v2.63A9.99 9.99 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.505 13.95a5.97 5.97 0 0 1-.307-1.95c0-.68.117-1.34.307-1.95V7.42H3.1A9.99 9.99 0 0 0 2 12c0 1.61.387 3.13 1.1 4.58l3.405-2.63Z"
        fill="#FBBC05"
      />
      <path
        d="M12 6.02c1.47 0 2.79.51 3.83 1.52l2.87-2.87C16.96 3.06 14.7 2 12 2A9.99 9.99 0 0 0 3.1 7.42l3.405 2.63c.775-2.31 2.94-4.03 5.495-4.03Z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>('login')
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)
  const [isSignupLoading, setIsSignupLoading] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!supabase) {
      setIsCheckingSession(false)
      return
    }

    let isActive = true

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isActive) return

        if (data.session) {
          void navigate(DASHBOARD_PATH, { replace: true })
          return
        }

        setIsCheckingSession(false)
      })
      .catch(() => {
        if (!isActive) return
        setIsCheckingSession(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        void navigate(DASHBOARD_PATH, { replace: true })
      }
    })

    return () => {
      isActive = false
      subscription.unsubscribe()
    }
  }, [navigate])

  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(() => {
      setToast(null)
    }, 4200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [toast])

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setToast({
        type: 'error',
        message: 'Configure SUPABASE_URL e SUPABASE_ANON_KEY para habilitar o login.',
      })
      return
    }

    try {
      setIsGoogleLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${DASHBOARD_PATH}`,
        },
      })

      if (error) {
        setToast({
          type: 'error',
          message: `Nao foi possivel iniciar o login com Google: ${error.message}`,
        })
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const onGoogleLoginClick = () => {
    void handleGoogleLogin()
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase) {
      setToast({
        type: 'error',
        message: 'Configure SUPABASE_URL e SUPABASE_ANON_KEY para habilitar o login.',
      })
      return
    }

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password.trim()) return

    try {
      setIsLoginLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        setToast({
          type: 'error',
          message: `Nao foi possivel entrar: ${error.message}`,
        })
        return
      }

      void navigate(DASHBOARD_PATH, { replace: true })
    } finally {
      setIsLoginLoading(false)
    }
  }

  const onLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleLogin(event)
  }

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase) {
      setToast({
        type: 'error',
        message: 'Configure SUPABASE_URL e SUPABASE_ANON_KEY para habilitar o login.',
      })
      return
    }

    const normalizedEmail = email.trim()
    const normalizedPassword = password.trim()
    const normalizedConfirmPassword = confirmPassword.trim()

    if (!normalizedEmail || !normalizedPassword || !normalizedConfirmPassword) return

    if (normalizedPassword.length < 8) {
      setToast({
        type: 'error',
        message: 'A senha deve ter pelo menos 8 caracteres.',
      })
      return
    }

    if (normalizedPassword !== normalizedConfirmPassword) {
      setToast({
        type: 'error',
        message: 'As senhas nao conferem.',
      })
      return
    }

    try {
      setIsSignupLoading(true)

      const { data, error: signupError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: normalizedPassword,
      })

      if (signupError) {
        setToast({
          type: 'error',
          message: `Nao foi possivel criar a conta: ${signupError.message}`,
        })
        return
      }

      // Se o Supabase retornar uma sessão, o email não precisa de confirmação = login automático
      if (data.session) {
        void navigate(DASHBOARD_PATH, { replace: true })
        return
      }

      // Se não retornou sessão, é porque a verificação por e-mail AINDA ESTÁ ATIVADA no painel
      setToast({
        type: 'error',
        message:
          'Aviso: Você precisa desativar a "Confirmação de Email" no painel do Supabase (Authentication > Providers > Email).',
      })
    } finally {
      setIsSignupLoading(false)
    }
  }

  const onSignupSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSignup(event)
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      void navigate(-1)
      return
    }

    void navigate('/')
  }

  const handleGoToLanding = () => {
    void navigate('/')
  }

  if (isCheckingSession) {
    return (
      <div className={styles.page}>
        <div className={styles.glowTop} />
        <div className={styles.glowBottom} />
        <div className={styles.checkingState}>
          <LoaderCircle className={styles.loadingIcon} size={22} />
          <span>Verificando sessao...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Brand Section Left */}
      <div className={styles.brandSection}>
        <div className={styles.brandGlow} />

        <div className={styles.brandLogo}>
          <Logo size={40} className={styles.logoIcon} />
          <span className={styles.brandName}>HealthLens</span>
        </div>

        <div className={styles.brandContent}>
          <h1 className={styles.brandTitle}>
            Seu dataset clínico,
            <br />
            entendido em segundos.
          </h1>
          <p className={styles.brandSubtitle}>
            Solução inteligente para análise de dados médicos, relatórios e detecção de anomalias
            com agilidade e precisão automatizada.
          </p>
        </div>
      </div>

      {/* Form Section Right */}
      <main className={styles.formSection}>
        <div className={styles.topActions}>
          <button type="button" className={styles.backButton} onClick={handleBack}>
            <ArrowLeft size={16} />
            <span>Voltar</span>
          </button>
          <button
            type="button"
            className={styles.backButton}
            onClick={handleGoToLanding}
            aria-label="Ir para landing page"
          >
            <House size={16} />
          </button>
        </div>

        <div className={styles.formWrapper}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className={styles.formSubtitle}>
              {mode === 'login'
                ? 'Insira seus dados para acessar seus datasets.'
                : 'Preencha os dados abaixo para começar.'}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className={styles.googleButton}
            onClick={onGoogleLoginClick}
            disabled={isGoogleLoading || isLoginLoading || isSignupLoading || !isSupabaseConfigured}
          >
            {isGoogleLoading ? (
              <LoaderCircle className={styles.loadingIcon} size={18} />
            ) : (
              <GoogleIcon />
            )}
            <span>{isGoogleLoading ? 'Conectando...' : 'Entrar com Google'}</span>
          </Button>

          <div className={styles.divider} role="separator" aria-label="ou">
            <span>ou</span>
          </div>

          <form
            className={styles.form}
            onSubmit={mode === 'login' ? onLoginSubmit : onSignupSubmit}
          >
            <label className={styles.label} htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@clinica.com"
              className={styles.input}
              autoComplete="email"
              required
              disabled={isLoginLoading || isSignupLoading}
            />

            <label className={styles.label} htmlFor="auth-password">
              Senha
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                mode === 'signup' ? 'Crie uma senha com no minimo 8 caracteres' : 'Sua senha'
              }
              className={styles.input}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              required
              disabled={isLoginLoading || isSignupLoading}
            />

            {mode === 'signup' && (
              <>
                <label className={styles.label} htmlFor="auth-confirm-password">
                  Confirmar senha
                </label>
                <input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita sua senha"
                  className={styles.input}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={isSignupLoading}
                />
              </>
            )}

            <Button
              type="submit"
              size="lg"
              className={styles.magicButton}
              disabled={
                mode === 'login'
                  ? isLoginLoading || !email.trim() || !password.trim() || !isSupabaseConfigured
                  : isSignupLoading ||
                    !email.trim() ||
                    !password.trim() ||
                    !confirmPassword.trim() ||
                    !isSupabaseConfigured
              }
            >
              {(isLoginLoading || isSignupLoading) && (
                <LoaderCircle className={styles.loadingIcon} size={18} />
              )}
              <span>
                {mode === 'login'
                  ? isLoginLoading
                    ? 'Entrando...'
                    : 'Entrar'
                  : isSignupLoading
                    ? 'Criando conta...'
                    : 'Criar conta'}
              </span>
            </Button>

            {mode === 'login' ? (
              <p className={styles.modeHint}>
                Nao possui conta?
                <button
                  type="button"
                  className={styles.modeHintAction}
                  onClick={() => setMode('signup')}
                >
                  Criar conta
                </button>
              </p>
            ) : (
              <p className={styles.modeHint}>
                Ja possui conta?
                <button
                  type="button"
                  className={styles.modeHintAction}
                  onClick={() => setMode('login')}
                >
                  Entrar
                </button>
              </p>
            )}
          </form>

          {!isSupabaseConfigured && (
            <p className={styles.configurationHint}>
              Defina as variaveis de ambiente do Supabase para ativar cadastro e login.
            </p>
          )}
        </div>
      </main>

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
