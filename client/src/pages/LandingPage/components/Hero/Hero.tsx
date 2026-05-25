import { Button } from '@/components/ui/Button/Button'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import styles from './Hero.module.scss'

export function Hero() {
  return (
    <section className={styles.hero}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={styles.heroContent}
      >
        <h1 className="gradient-text font-semibold">Análise de Dados do SINAN</h1>
        <p className="text-secondary text-xl mt-6">
          Plataforma para análise de dados epidemiológicos do SINAN. Visualize séries temporais,
          explore indicadores e gere insights com IA.
        </p>

        <div className={styles.heroButtons}>
          <Link to="/login" aria-label="Criar conta ou fazer login">
            <Button size="lg">Começar agora</Button>
          </Link>
          <Link to="/login" aria-label="Fazer login">
            <Button size="lg" variant="outline">
              Já tenho conta
            </Button>
          </Link>
        </div>

        <div className={styles.formats}>
          <span className="text-muted text-sm">Formatos suportados:</span>
          <div className={styles.formatBadges}>
            <div className={styles.badgeFormat}>.CSV</div>
            <div className={styles.badgeFormat}>.JSON</div>
            <div className={styles.badgeFormat}>.XLSX</div>
            <div className={styles.badgeFormat}>.DBC</div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
