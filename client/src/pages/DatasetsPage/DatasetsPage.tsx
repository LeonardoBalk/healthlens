import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Database, Download, FileJson, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import {
  deleteChartDataset,
  exportDatasetAsCsv,
  exportDatasetAsJson,
  fetchChartDatasets,
  getActiveChartDatasetId,
  setActiveChartDatasetId,
  type ChartDatasetRecord,
} from '@/utils/chartDatasets'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './DatasetsPage.module.scss'

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return 'data indisponivel'
  return parsed.toLocaleDateString('pt-BR')
}

export default function DatasetsPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [datasets, setDatasets] = useState<ChartDatasetRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadDatasets = async () => {
      setIsLoading(true)
      const loadedDatasets = await fetchChartDatasets()

      if (cancelled) return

      setDatasets(loadedDatasets)

      const activeId = getActiveChartDatasetId()
      const nextActiveId =
        activeId && loadedDatasets.some((dataset) => dataset.id === activeId)
          ? activeId
          : (loadedDatasets[0]?.id ?? null)

      setActiveDatasetId(nextActiveId)
      if (nextActiveId) {
        setActiveChartDatasetId(nextActiveId)
      }
      setIsLoading(false)
    }

    void loadDatasets()

    return () => {
      cancelled = true
    }
  }, [])

  const orderedDatasets = useMemo(() => {
    if (!activeDatasetId) return datasets
    return [...datasets].sort((a, b) => {
      if (a.id === activeDatasetId) return -1
      if (b.id === activeDatasetId) return 1
      return b.uploadedAt.localeCompare(a.uploadedAt)
    })
  }, [activeDatasetId, datasets])

  const handleImport = () => {
    void navigate('/datasets/new')
  }

  const handleSelectDataset = (datasetId: string) => {
    setActiveDatasetId(datasetId)
    setActiveChartDatasetId(datasetId)
  }

  const handleDeleteDataset = async (datasetId: string) => {
    const target = datasets.find((dataset) => dataset.id === datasetId)
    if (!target || target.source === 'seed') return

    if (settings.confirmBeforeDelete) {
      const confirmed = window.confirm(
        `Excluir o dataset "${target.name}"? Essa ação não pode ser desfeita.`
      )
      if (!confirmed) return
    }

    setDeletingId(datasetId)
    const deleted = await deleteChartDataset(datasetId)
    setDeletingId(null)

    if (!deleted) return

    setDatasets((current) => {
      const next = current.filter((dataset) => dataset.id !== datasetId)

      if (activeDatasetId === datasetId) {
        const nextActive = next[0]?.id ?? null
        setActiveDatasetId(nextActive)
        if (nextActive) {
          setActiveChartDatasetId(nextActive)
        }
      }

      return next
    })
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Meus Datasets</h1>
        </header>
        <div className={styles.list}>
          <div className={styles.datasetCard}>Carregando datasets do Supabase...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Meus Datasets</h1>
        <Button onClick={handleImport}>
          <Plus size={18} />
          <span>Importar Dataset</span>
        </Button>
      </header>

      <div className={styles.list}>
        {orderedDatasets.map((dataset) => {
          const isActive = activeDatasetId === dataset.id

          return (
            <div
              key={dataset.id}
              className={`${styles.datasetCard} ${isActive ? styles.active : ''}`}
              onClick={() => handleSelectDataset(dataset.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  handleSelectDataset(dataset.id)
                }
              }}
            >
              <div className={styles.info}>
                <div className={styles.iconWrapper}>
                  <Database size={24} />
                </div>
                <div className={styles.details}>
                  <span className={styles.name}>{dataset.name}</span>
                  <span className={styles.meta}>
                    Adicionado em {formatDate(dataset.uploadedAt)} - {dataset.sizeLabel}
                  </span>
                </div>
              </div>

              <div className={styles.actions}>
                {dataset.source === 'upload' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.deleteButton}
                    disabled={deletingId === dataset.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDeleteDataset(dataset.id)
                    }}
                  >
                    <Trash2 size={16} />
                    <span>{deletingId === dataset.id ? 'Excluindo...' : 'Excluir'}</span>
                  </Button>
                )}

                <div className={`${styles.status} ${isActive ? styles.activeStatus : ''}`}>
                  {isActive ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Ativo</span>
                    </>
                  ) : (
                    <span>Selecionar</span>
                  )}
                </div>
              </div>

              <div className={styles.exportActions}>
                <button
                  type="button"
                  className={styles.exportButton}
                  title="Exportar como CSV"
                  onClick={(event) => {
                    event.stopPropagation()
                    exportDatasetAsCsv(dataset)
                  }}
                >
                  <Download size={15} />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  className={styles.exportButton}
                  title="Exportar como JSON"
                  onClick={(event) => {
                    event.stopPropagation()
                    exportDatasetAsJson(dataset)
                  }}
                >
                  <FileJson size={15} />
                  <span>JSON</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
