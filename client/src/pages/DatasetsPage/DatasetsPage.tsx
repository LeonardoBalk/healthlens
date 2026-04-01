import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Database, Plus, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import styles from './DatasetsPage.module.scss'

const MOCKED_DATASETS = [
  { id: 1, name: 'Pacientes_Cardio_2023.csv', date: '2023-10-01', size: '2.4 MB' },
  { id: 2, name: 'Exames_Sangue_Q1.xlsx', date: '2023-11-15', size: '1.1 MB' },
  { id: 3, name: 'Registros_Neurologia.json', date: '2024-01-10', size: '4.8 MB' },
]

export default function DatasetsPage() {
  const navigate = useNavigate()
  const [activeDatasetId, setActiveDatasetId] = useState<number | null>(1)

  const handleImport = () => {
    void navigate('/datasets/new')
  }

  const handleSelectDataset = (id: number) => {
    setActiveDatasetId(id)
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
        {MOCKED_DATASETS.map((dataset) => {
          const isActive = activeDatasetId === dataset.id

          return (
            <div
              key={dataset.id}
              className={`${styles.datasetCard} ${isActive ? styles.active : ''}`}
              onClick={() => handleSelectDataset(dataset.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
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
                    Adicionado em {dataset.date} • {dataset.size}
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
