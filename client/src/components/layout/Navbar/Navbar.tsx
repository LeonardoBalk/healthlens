import { Button } from '@/components/ui/Button/Button'
import { Logo } from '@/components/ui/Logo/Logo'
import styles from './Navbar.module.scss'

export function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.navContainer}>
        <div className={styles.logo}>
          <Logo size={32} />
          <span style={{ marginLeft: '4px' }}>
            <span className="font-bold text-xl" style={{ color: '#FAFAFA' }}>
              Health
            </span>
            <span className="font-bold text-xl" style={{ color: '#FF2D55' }}>
              Lens
            </span>
          </span>
        </div>

        <nav className={styles.navLinks}></nav>

        <div className={styles.navActions}>
          <Button size="sm">Começar</Button>
        </div>
      </div>
    </header>
  )
}
