import { BarChart2, Download, FileSearch, MessageSquare, ShieldAlert } from 'lucide-react'
import styles from './Features.module.scss'

const STEPS = [
  {
    icon: Download,
    label: 'Baixe do DataSUS',
    hint: 'Acesse datasus.gov.br, selecione o agravo (Dengue, Zika, Tuberculose…) e exporte o arquivo .dbc do SINAN. Qualquer período ou UF é aceito.',
  },
  {
    icon: FileSearch,
    label: 'Importe no HealthLens',
    hint: 'Faça upload do .dbc, .csv, .json ou .xlsx. O sistema detecta e mapeia automaticamente as colunas SINAN.',
  },
  {
    icon: BarChart2,
    label: 'Explore e compartilhe',
    hint: 'Visualize gráficos, séries temporais e relatórios epidemiológicos. Converse com a IA e exporte em PDF com um clique.',
  },
]

const FEATURES = [
  {
    icon: ShieldAlert,
    title: 'Análise de Agravos SINAN',
    description:
      'Importe dados de Dengue, Zika, Chikungunya, Tuberculose e outros agravos. O sistema calcula automaticamente indicadores epidemiológicos: incidência, letalidade e distribuição temporal e etária.',
  },
  {
    icon: BarChart2,
    title: 'Curvas Epidemiológicas',
    description:
      'Visualize curvas de casos e óbitos ao longo do tempo com média móvel de 3 períodos. Detecta gaps temporais automaticamente e alerta sobre registros sem data de notificação.',
  },
  {
    icon: MessageSquare,
    title: 'Chat com IA integrado',
    description:
      'Faça perguntas em linguagem natural sobre seus dados. A IA interpreta os indicadores do dataset, faz cálculos de tendência e responde perguntas gerais de epidemiologia e agravos.',
  },
]

export function Features() {
  return (
    <section className={styles.featuresSection} id="features">
      <div className="container">
        <div className={styles.sectionHeader}>
          <h2 className={`gradient-text ${styles.sectionTitle}`}>Como funciona</h2>
          <p className={styles.sectionSubtitle}>
            Do arquivo bruto do DataSUS ao insight epidemiológico em minutos, sem configuração.
          </p>
        </div>

        {/* Desktop */}
        <div className={styles.stepsRow}>
          {STEPS.map(({ icon: Icon, label, hint }, index) => (
            <div key={label} className={styles.stepItem}>
              {index > 0 && <div className={styles.lineLeft} />}
              {index < STEPS.length - 1 && <div className={styles.lineRight} />}

              <div className={styles.stepIconWrapper}>
                <span className={styles.stepBadge}>{index + 1}</span>
                <div className={styles.stepCircle}>
                  <div className={styles.stepCircleInner}>
                    <Icon size={26} />
                  </div>
                </div>
              </div>

              <strong className={styles.stepLabel}>{label}</strong>
              <p className={styles.stepHint}>{hint}</p>
            </div>
          ))}
        </div>

        <div className={`${styles.sectionHeader} ${styles.sectionHeaderSpaced}`}>
          <h2 className={`gradient-text ${styles.sectionTitle}`}>O que você pode analisar</h2>
          <p className={styles.sectionSubtitle}>
            Ferramentas especializadas para dados epidemiológicos do SINAN.
          </p>
        </div>

        <div className="grid-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className={styles.featureCard}>
              <div className={styles.iconWrapper}>
                <Icon size={22} strokeWidth={2.2} />
              </div>
              <h3 className={styles.featureTitle}>{title}</h3>
              <p className={styles.featureDescription}>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
