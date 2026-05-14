import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Database, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { useDatasets } from '@/contexts/DatasetContext'
import { useSettings } from '@/contexts/SettingsContext'
import datasetStyles from './DatasetsPage/DatasetsPage.module.scss'
import styles from './OverviewPage.module.scss'

const INTEGER_FORMATTER = new Intl.NumberFormat('pt-BR')
const formatInteger = (value: number) => INTEGER_FORMATTER.format(Math.round(value))

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return 'data indisponivel'
  return parsed.toLocaleDateString('pt-BR')
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { datasets, activeDataset, isLoading, setActiveDataset } = useDatasets()

  const displayedDatasets = useMemo(() => {
    if (settings.recentDatasetsCount === 'all') return datasets
    const limit = parseInt(settings.recentDatasetsCount, 10)
    return isNaN(limit) ? datasets.slice(0, 5) : datasets.slice(0, limit)
  }, [datasets, settings.recentDatasetsCount])

  const activeDatasetLabel = activeDataset?.name ?? 'Sem dataset ativo'
  const lastUploadLabel = activeDataset ? formatDate(activeDataset.uploadedAt) : 'Sem dados'
  const activeRowsLabel = activeDataset
    ? formatInteger(activeDataset.profile?.rowCount ?? 0)
    : 'Sem dados'
  const totalDatasetsLabel = formatInteger(datasets.length)

  const handleDatasetClick = (datasetId: string) => {
    setActiveDataset(datasetId)
    void navigate('/datasets/charts')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={`gradient-text ${styles.title}`}>Painel Epidemiológico</h1>
        <p className={styles.subtitle}>
          Visão geral dos seus datasets do SINAN e das análises epidemiológicas.
        </p>
      </header>

      <section className={styles.summaryGrid} aria-label="Resumo do painel">
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Datasets</span>
          <strong className={styles.summaryValue}>{totalDatasetsLabel}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Dataset ativo</span>
          <strong className={styles.summaryValue}>{activeDatasetLabel}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Último upload</span>
          <strong className={styles.summaryValue}>{lastUploadLabel}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Registros ativos</span>
          <strong className={styles.summaryValue}>{activeRowsLabel}</strong>
        </article>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Datasets Recentes</h2>
            <p className={styles.sectionHint}>
              Clique em um dataset para ativá-lo e ir para os gráficos.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void navigate('/datasets/list')}>
            Ver todos
            <ArrowRight size={16} style={{ marginLeft: 'var(--space-2)' }} />
          </Button>
        </div>

        {isLoading ? (
          <div className={datasetStyles.list}>
            <div className={datasetStyles.datasetCard}>Carregando datasets...</div>
          </div>
        ) : displayedDatasets.length === 0 ? (
          <div className={datasetStyles.list}>
            <div
              className={datasetStyles.datasetCard}
              style={{ justifyContent: 'center', padding: 'var(--space-6)' }}
            >
              Nenhum dataset encontrado.
            </div>
          </div>
        ) : (
          <div className={datasetStyles.list}>
            {displayedDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className={`${datasetStyles.datasetCard} ${dataset.id === activeDataset?.id ? datasetStyles.datasetCardActive : ''}`}
                onClick={() => handleDatasetClick(dataset.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') handleDatasetClick(dataset.id)
                }}
              >
                <div className={datasetStyles.info}>
                  <div className={datasetStyles.iconWrapper}>
                    <Database size={24} />
                  </div>
                  <div className={datasetStyles.details}>
                    <span className={datasetStyles.name}>{dataset.name}</span>
                    <span className={datasetStyles.meta}>
                      Adicionado em {formatDate(dataset.uploadedAt)} — {dataset.sizeLabel}
                    </span>
                  </div>
                </div>
                <ArrowRight size={16} style={{ flexShrink: 0, opacity: 0.4 }} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.actions} aria-label="Ações rápidas">
        <Button onClick={() => void navigate('/datasets/new')}>
          <Download size={18} />
          <span>Importar Novo Dataset</span>
        </Button>
        <Button variant="outline" onClick={() => void navigate('/datasets/charts')}>
          Ir para os Gráficos
          <ArrowRight size={18} style={{ marginLeft: 'var(--space-2)' }} />
        </Button>
      </section>
    </div>
  )
}
