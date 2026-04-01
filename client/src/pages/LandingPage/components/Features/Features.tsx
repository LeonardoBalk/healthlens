import { Database, BarChart2, MessageSquare } from 'lucide-react'
import styles from './Features.module.scss'

export function Features() {
  return (
    <section className={styles.featuresSection} id="features">
      <div className="container">
        <h2 className="text-center mb-8">Como analisamos seus dados</h2>

        <div className="grid-3">
          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <Database size={22} strokeWidth={2.2} />
            </div>
            <h3 className="text-xl mb-4 mt-6">Estatísticas automáticas</h3>
            <p className="text-secondary flex-1">
              Upload simples do seu dataset. O sistema calcula automaticamente médias, distribuições
              e resumos para análise instantânea.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <BarChart2 size={22} strokeWidth={2.2} />
            </div>
            <h3 className="text-xl mb-4 mt-6">Gráficos interativos</h3>
            <p className="text-secondary flex-1">
              Crie visualizações avançadas cruzando variáveis, detectando outliers e explorando
              agrupamentos demográficos.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.iconWrapper}>
              <MessageSquare size={22} strokeWidth={2.2} />
            </div>
            <h3 className="text-xl mb-4 mt-6">Chat com IA</h3>
            <p className="text-secondary flex-1">
              Faça perguntas aos seus dados em linguagem natural. A inteligência artificial Python
              processa correlações e retorna insights prontos.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
