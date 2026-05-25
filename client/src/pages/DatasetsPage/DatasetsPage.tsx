import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  Database,
  Download,
  FileJson,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { useDatasets } from '@/contexts/DatasetContext'
import { useConfirm } from '@/components/ui/ConfirmDialog/ConfirmDialog'
import {
  deleteChartDataset,
  exportDatasetAsCsv,
  exportDatasetAsJson,
  regenerateDatasetProfile,
} from '@/utils/chartDatasets'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './DatasetsPage.module.scss'

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return 'data indisponível'
  return parsed.toLocaleDateString('pt-BR')
}

export default function DatasetsPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { datasets, activeDataset, isLoading, setActiveDataset, refresh } = useDatasets()
  const confirm = useConfirm()

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)

  const activeDatasetId = activeDataset?.id ?? null

  const deletableDatasets = useMemo(() => datasets.filter((d) => d.source === 'upload'), [datasets])

  const orderedDatasets = useMemo(() => {
    if (!activeDatasetId) return datasets
    return [...datasets].sort((a, b) => {
      if (a.id === activeDatasetId) return -1
      if (b.id === activeDatasetId) return 1
      return b.uploadedAt.localeCompare(a.uploadedAt)
    })
  }, [activeDatasetId, datasets])

  const selectedCount = selectedIds.size
  const allDeletableSelected =
    deletableDatasets.length > 0 && deletableDatasets.every((d) => selectedIds.has(d.id))

  const handleImport = () => void navigate('/datasets/new')

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (allDeletableSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(deletableDatasets.map((d) => d.id)))
    }
  }

  const handleDeleteDataset = async (datasetId: string) => {
    const target = datasets.find((d) => d.id === datasetId)
    if (!target || target.source === 'seed') return

    if (settings.confirmBeforeDelete) {
      const confirmed = await confirm({
        title: 'Excluir dataset',
        message: `Excluir o dataset "${target.name}"? Essa ação não pode ser desfeita.`,
        confirmLabel: 'Excluir',
        variant: 'danger',
      })
      if (!confirmed) return
    }

    setDeletingId(datasetId)
    const deleted = await deleteChartDataset(datasetId)
    setDeletingId(null)
    if (!deleted) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(datasetId)
      return next
    })
    await refresh()
  }

  const handleRegenerate = async (datasetId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRegeneratingId(datasetId)
    const ok = await regenerateDatasetProfile(datasetId)
    setRegeneratingId(null)
    if (ok) await refresh()
  }

  const handleBulkDelete = async () => {
    const targets = datasets.filter((d) => selectedIds.has(d.id) && d.source === 'upload')
    if (targets.length === 0) return

    const confirmed = await confirm({
      title: 'Excluir datasets selecionados',
      message: `Excluir ${targets.length} dataset${targets.length > 1 ? 's' : ''}? Essa ação não pode ser desfeita.`,
      confirmLabel: `Excluir ${targets.length}`,
      variant: 'danger',
    })
    if (!confirmed) return

    setDeletingBulk(true)
    await Promise.all(targets.map((d) => deleteChartDataset(d.id)))
    setDeletingBulk(false)
    setSelectedIds(new Set())
    await refresh()
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={`gradient-text ${styles.title}`}>Meus Datasets</h1>
            <p className={styles.subtitle}>Carregando datasets...</p>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={`gradient-text ${styles.title}`}>Meus Datasets</h1>
          <p className={styles.subtitle}>
            Gerencie e selecione os datasets disponíveis para análise.
          </p>
        </div>
        <div className={styles.headerActions}>
          {selectedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={styles.bulkDeleteButton}
              disabled={deletingBulk}
              onClick={() => void handleBulkDelete()}
            >
              <Trash2 size={16} />
              <span>{deletingBulk ? 'Excluindo...' : `Excluir ${selectedCount}`}</span>
            </Button>
          )}
          <Button onClick={handleImport}>
            <Plus size={18} />
            <span>Importar Dataset</span>
          </Button>
        </div>
      </header>

      {orderedDatasets.length === 0 && (
        <section className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Nenhum dataset disponível. Importe um arquivo SINAN para começar as análises
            epidemiológicas.
          </p>
          <Button size="lg" onClick={handleImport}>
            <Plus size={18} />
            <span>Importar dataset</span>
          </Button>
        </section>
      )}

      {deletableDatasets.length > 0 && (
        <div className={styles.listToolbar}>
          <button type="button" className={styles.selectAllBtn} onClick={toggleSelectAll}>
            <span
              className={`${styles.checkboxIcon} ${allDeletableSelected ? styles.checkboxIconChecked : ''}`}
            >
              {allDeletableSelected && <Check size={10} strokeWidth={3} />}
            </span>
            <span>{allDeletableSelected ? 'Desmarcar todos' : 'Selecionar todos'}</span>
          </button>
          {selectedCount > 0 && (
            <span className={styles.selectionCount}>
              {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className={styles.list}>
        {orderedDatasets.map((dataset) => {
          const isActive = activeDatasetId === dataset.id
          const isSelected = selectedIds.has(dataset.id)
          const isDeletable = dataset.source === 'upload'

          return (
            <div
              key={dataset.id}
              className={`${styles.datasetCard} ${isActive ? styles.datasetCardActive : ''} ${isSelected ? styles.datasetCardSelected : ''}`}
              onClick={() => setActiveDataset(dataset.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setActiveDataset(dataset.id)
              }}
            >
              {isDeletable && (
                <button
                  type="button"
                  className={styles.checkboxCell}
                  onClick={(e) => toggleSelect(dataset.id, e)}
                  aria-label={isSelected ? 'Desmarcar' : 'Selecionar'}
                >
                  <span
                    className={`${styles.checkboxIcon} ${isSelected ? styles.checkboxIconChecked : ''}`}
                  >
                    {isSelected && <Check size={10} strokeWidth={3} />}
                  </span>
                </button>
              )}

              <div className={styles.info}>
                <div className={styles.iconWrapper}>
                  <Database size={24} />
                </div>
                <div className={styles.details}>
                  <span className={styles.name}>{dataset.name}</span>
                  <span className={styles.meta}>
                    Adicionado em {formatDate(dataset.uploadedAt)} · {dataset.sizeLabel}
                  </span>
                </div>
              </div>

              <div className={styles.actions}>
                {isDeletable && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.deleteButton}
                    disabled={deletingId === dataset.id || deletingBulk}
                    onClick={(e) => {
                      e.stopPropagation()
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
                  onClick={(e) => {
                    e.stopPropagation()
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
                  onClick={(e) => {
                    e.stopPropagation()
                    exportDatasetAsJson(dataset)
                  }}
                >
                  <FileJson size={15} />
                  <span>JSON</span>
                </button>
                {isDeletable && (
                  <button
                    type="button"
                    className={styles.exportButton}
                    title="Regenerar perfil a partir do arquivo original"
                    disabled={regeneratingId === dataset.id}
                    onClick={(e) => void handleRegenerate(dataset.id, e)}
                  >
                    <RefreshCcw
                      size={15}
                      className={regeneratingId === dataset.id ? styles.spinning : undefined}
                    />
                    <span>{regeneratingId === dataset.id ? 'Regenerando...' : 'Regenerar'}</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
