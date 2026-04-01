import { Logo } from '@/components/ui/Logo/Logo'
import styles from './Footer.module.scss'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container py-4 ${styles.inner}`}>
        <div className={styles.brand}>
          <Logo size={24} />
          <span>
            <strong className={styles.brandHealth}>Health</strong>
            <strong className={styles.brandLens}>Lens</strong>
          </span>
        </div>
        <p className={styles.copy}>
          &copy; {new Date().getFullYear()} HealthLens. Todos os direitos reservados.
        </p>
        <div className={styles.links}>
          <a
            href="https://github.com/LeonardoBalk/healthlens"
            target="_blank"
            rel="noreferrer"
            className={styles.link}
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}
