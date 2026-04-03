import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Database, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import {
  getActiveChartDatasetId,
  getAllChartDatasets,
  setActiveChartDatasetId,
  type ChartDatasetRecord,
} from '@/utils/chartDatasets'
import styles from './DatasetsPage.module.scss'

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return 'data indisponivel'
  return parsed.toLocaleDateString('pt-BR')
}

export default function DatasetsPage() {
  const navigate = useNavigate()
  const datasets = useMemo<ChartDatasetRecord[]>(() => getAllChartDatasets(), [])
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(() => {
    const activeId = getActiveChartDatasetId()
    if (activeId && datasets.some((dataset) => dataset.id === activeId)) return activeId
    return datasets[0]?.id ?? null
  })

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
          )
        })}
      </div>
    </div>
  )
}
