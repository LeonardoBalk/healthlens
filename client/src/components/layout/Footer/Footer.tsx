import { Logo } from '@/components/ui/Logo/Logo'
import styles from './Footer.module.scss'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container flex-between py-6">
        <div className="flex-center gap-2">
          <Logo size={24} />
          <span>
            <strong style={{ color: '#FAFAFA' }}>Health</strong>
            <strong style={{ color: '#FF2D55' }}>Lens</strong>
          </span>
        </div>
        <p className="text-sm text-muted">
          &copy; {new Date().getFullYear()} HealthLens. Todos os direitos reservados.
        </p>
        <div className="flex gap-4">
          <a
            href="https://github.com/LeonardoBalk/healthlens"
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-primary"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
