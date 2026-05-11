import { BarChart2, MessageSquare, ShieldAlert } from 'lucide-react'
import styles from './Features.module.scss'

export function Features() {
  return (
    <section className={styles.featuresSection} id="features">
      <div className="container">
        <h2 className="text-center mb-8">Como monitoramos doenças virais</h2>

        <div className="grid-3">
          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <ShieldAlert size={22} strokeWidth={2.2} />
            </div>
            <h3 className="text-xl mb-4 mt-6">Vigilância de Surtos</h3>
            <p className="text-secondary flex-1">
              Importe dados do SINAN (Dengue, Zika, Chikungunya, entre outros). O sistema calcula
              automáticamente indicadores epidemiológicos como incidência, letalidade e distribuição
              temporal.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <BarChart2 size={22} strokeWidth={2.2} />
            </div>
            <h3 className="text-xl mb-4 mt-6">Curvas Epidemiológicas</h3>
            <p className="text-secondary flex-1">
              Visualize curvas de casos e óbitos ao longo do tempo, com média móvel, distribuição
              demográfica e análise por região e faixa etária.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <MessageSquare size={22} strokeWidth={2.2} />
            </div>
            <h3 className="text-xl mb-4 mt-6">Insights com IA</h3>
            <p className="text-secondary flex-1">
              Faça perguntas sobre seus dados epidemiológicos em linguagem natural. A IA identifica
              padrões de transmissão, sazonalidade e fatores de risco.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
