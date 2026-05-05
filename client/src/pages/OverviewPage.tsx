import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Database, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { fetchChartDatasets, type ChartDatasetRecord } from '@/utils/chartDatasets'
import { useSettings } from '@/contexts/SettingsContext'
import datasetStyles from './DatasetsPage/DatasetsPage.module.scss'

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return 'data indisponivel'
  return parsed.toLocaleDateString('pt-BR')
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [datasets, setDatasets] = useState<ChartDatasetRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadDatasets = async () => {
      setIsLoading(true)
      const loadedDatasets = await fetchChartDatasets()
      if (!cancelled) {
        setDatasets(loadedDatasets.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)))
        setIsLoading(false)
      }
    }

    void loadDatasets()

    return () => {
      cancelled = true
    }
  }, [])

  const displayedDatasets = (() => {
    if (settings.recentDatasetsCount === 'all') return datasets
    const limit = parseInt(settings.recentDatasetsCount, 10)
    return isNaN(limit) ? datasets.slice(0, 5) : datasets.slice(0, limit)
  })()

  return (
    <div
      className="page"
      style={{
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      <header>
        <h1 className="gradient-text" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 600 }}>
          Painel Epidemiológico
        </h1>
        <p className="text-muted" style={{ marginTop: 'var(--space-2)' }}>
          Visão geral das análises de doenças virais contagiosas e status dos seus datasets do
          SINAN.
        </p>
      </header>

      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-4)',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            Datasets Recentes
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigate('/datasets/list')
            }}
          >
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
                className={datasetStyles.datasetCard}
                onClick={() => {
                  void navigate('/datasets/list')
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    void navigate('/datasets/list')
                  }
                }}
              >
                <div className={datasetStyles.info}>
                  <div className={datasetStyles.iconWrapper}>
                    <Database size={24} />
                  </div>
                  <div className={datasetStyles.details}>
                    <span className={datasetStyles.name}>{dataset.name}</span>
                    <span className={datasetStyles.meta}>
                      Adicionado em {formatDate(dataset.uploadedAt)} - {dataset.sizeLabel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <Button
          onClick={() => {
            void navigate('/datasets/new')
          }}
        >
          <Download size={18} />
          <span>Importar Novo Dataset</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void navigate('/datasets/charts')
          }}
        >
          Ir para os Gráficos
          <ArrowRight size={18} style={{ marginLeft: 'var(--space-2)' }} />
        </Button>
      </section>
    </div>
  )
}
