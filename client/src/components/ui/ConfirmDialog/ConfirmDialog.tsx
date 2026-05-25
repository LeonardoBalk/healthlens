import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button/Button'
import styles from './ConfirmDialog.module.scss'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

type DialogState = ConfirmOptions & { resolve: (value: boolean) => void }

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve })
    })
  }, [])

  const handleClose = (value: boolean) => {
    dialog?.resolve(value)
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div className={styles.backdrop} onClick={() => handleClose(false)} role="presentation">
          <div
            className={styles.dialog}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
          >
            <strong id="confirm-title" className={styles.title}>
              {dialog.title}
            </strong>
            <p id="confirm-message" className={styles.message}>
              {dialog.message}
            </p>
            <div className={styles.actions}>
              <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                {dialog.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className={dialog.variant !== 'primary' ? styles.dangerButton : undefined}
                onClick={() => handleClose(true)}
              >
                {dialog.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}
