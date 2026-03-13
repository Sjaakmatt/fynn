// src/components/ui/index.tsx
// ─── Fynn Design System — Shared UI Primitives ──────────────────────────────
// Gebaseerd op de SubscriptionCancelModal als referentie.
// Gebruik deze componenten in alle nieuwe en bestaande componenten.
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MODAL                                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Consistent bottom-sheet (mobiel) / centered modal (desktop).
 *
 * Referentie: SubscriptionCancelModal
 *
 * Features:
 * - Backdrop click sluit
 * - Escape sluit
 * - Body scroll lock
 * - Drag handle op mobiel
 * - Portal naar document.body
 *
 * @example
 * <Modal onClose={() => setOpen(false)}>
 *   <ModalHeader label="Sectie" title="Titel" onClose={() => setOpen(false)} />
 *   <ModalBody>...content...</ModalBody>
 * </Modal>
 */

interface ModalProps {
  onClose: () => void
  children: React.ReactNode
  /** Max breedte op desktop. Default: 'sm:max-w-md' */
  maxWidth?: string
  /** z-index. Default: 100 */
  zIndex?: number
}

export function Modal({ onClose, children, maxWidth = 'sm:max-w-md', zIndex = 100 }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', zIndex }}
      onClick={onClose}
    >
      <div
        className={`w-full ${maxWidth} rounded-t-2xl sm:rounded-2xl flex flex-col`}
        style={{ backgroundColor: 'var(--bg)', maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobiel only */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {children}
      </div>
    </div>,
    document.body
  )
}

/* ─── Modal sub-components ─────────────────────────────────────────────────── */

interface ModalHeaderProps {
  /** Klein label boven de titel (uppercase, muted) */
  label?: string
  title: string
  onClose: () => void
  children?: React.ReactNode
}

export function ModalHeader({ label, title, onClose, children }: ModalHeaderProps) {
  return (
    <div className="px-6 pt-5 pb-4 flex items-start justify-between">
      <div>
        {label && (
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            {label}
          </p>
        )}
        <p className={`text-lg font-semibold ${label ? 'mt-1' : ''}`} style={{ color: 'var(--text)' }}>
          {title}
        </p>
        {children}
      </div>
      <button onClick={onClose} className="mt-1 text-lg leading-none" style={{ color: 'var(--muted)' }}>
        ✕
      </button>
    </div>
  )
}

export function ModalBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex-1 overflow-y-auto px-6 pb-6 ${className}`}>
      {children}
    </div>
  )
}

/** Dunne progress bar onder de header voor multi-step flows */
export function ModalProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="px-6 pb-4">
      <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ backgroundColor: 'var(--brand)', width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  FULLSCREEN OVERLAY                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Full-screen overlay (geen backdrop, vult heel het scherm).
 * Gebruikt door VasteLastenKalender en SpaargoalCoach GoalDetail.
 *
 * @example
 * <FullscreenOverlay onClose={() => setOpen(false)} title="Kalender" zIndex={200}>
 *   ...content...
 * </FullscreenOverlay>
 */

interface FullscreenOverlayProps {
  onClose: () => void
  title: string
  /** Rechter element in de header (bijv. toggle) */
  headerRight?: React.ReactNode
  children: React.ReactNode
  zIndex?: number
}

export function FullscreenOverlay({ onClose, title, headerRight, children, zIndex = 200 }: FullscreenOverlayProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: 'var(--bg)', zIndex }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button onClick={onClose} className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <span>←</span> Terug
        </button>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </p>
        {headerRight ?? <div style={{ width: 60 }} />}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>,
    document.body
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  CONFIRM DIALOG                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Bottom-positioned confirm dialog.
 * Gebruikt door VasteLastenKalender (delete) en kan overal hergebruikt worden.
 *
 * @example
 * <ConfirmDialog
 *   title="Verwijderen?"
 *   description="Dit kan niet ongedaan worden."
 *   confirmLabel="Verwijderen"
 *   destructive
 *   loading={deleting}
 *   onConfirm={() => handleDelete()}
 *   onCancel={() => setConfirm(false)}
 * />
 */

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Bevestigen',
  cancelLabel = 'Annuleren',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text)' }}>{title}</p>
        {description && (
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>{description}</p>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Bezig...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  BUTTON                                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const BUTTON_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: { backgroundColor: 'var(--brand)', color: 'white' },
  secondary: { backgroundColor: 'var(--tab-bg)', color: 'var(--text)' },
  danger: { backgroundColor: '#EF4444', color: 'white' },
  ghost: { backgroundColor: 'transparent', color: 'var(--brand)' },
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Full width. Default: false */
  full?: boolean
}

export function Button({
  variant = 'primary',
  full = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isSemibold = variant === 'primary' || variant === 'danger'
  return (
    <button
      className={`
        py-3.5 rounded-xl text-sm transition-opacity
        disabled:opacity-30
        ${isSemibold ? 'font-semibold' : 'font-medium'}
        ${full ? 'w-full' : ''}
        ${className}
      `.trim()}
      style={BUTTON_STYLES[variant]}
      {...props}
    >
      {children}
    </button>
  )
}

/** Twee knoppen naast elkaar (Terug / Verder patroon) */
export function ButtonGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 pt-1">{children}</div>
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  INPUT                                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--tab-bg)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
}

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  onChange?: (value: string) => void
}

export function Input({ label, onChange, className = '', ...props }: InputProps) {
  return (
    <div>
      {label && (
        <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      )}
      <input
        className={`w-full rounded-xl px-4 py-3 text-sm outline-none ${className}`}
        style={INPUT_STYLE}
        onChange={e => onChange?.(e.target.value)}
        {...props}
      />
    </div>
  )
}

interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string
  onChange?: (value: string) => void
}

export function Textarea({ label, onChange, className = '', ...props }: TextareaProps) {
  return (
    <div>
      {label && (
        <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{label}</p>
      )}
      <textarea
        className={`w-full rounded-xl px-4 py-3 text-sm outline-none resize-none ${className}`}
        style={{ ...INPUT_STYLE, lineHeight: 1.6 }}
        onChange={e => onChange?.(e.target.value)}
        {...props}
      />
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  CARD                                                                      */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Standaard kaart container.
 *
 * @example
 * <Card>
 *   <CardHeader title="Titel" subtitle="Ondertitel" />
 *   <CardBody>...content...</CardBody>
 *   <CardFooter>...acties...</CardFooter>
 * </Card>
 */

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  /** Rechter element (button, badge, etc.) */
  action?: React.ReactNode
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
      <div>
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</h2>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-5 py-4 border-t ${className}`} style={{ borderColor: 'var(--border)' }}>
      {children}
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SELECTABLE OPTION                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Selecteerbare optie (radio-style button).
 * Gebruikt in SubscriptionCancelModal voor reden-selectie.
 */

interface SelectableOptionProps {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}

export function SelectableOption({ selected, onClick, children }: SelectableOptionProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
      style={{
        backgroundColor: selected
          ? 'color-mix(in srgb, var(--brand) 12%, transparent)'
          : 'var(--tab-bg)',
        color: selected ? 'var(--brand)' : 'var(--text)',
        border: selected ? '1px solid var(--brand)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  INFO BOX                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface InfoBoxProps {
  children: React.ReactNode
  variant?: 'neutral' | 'success' | 'warning' | 'error'
}

const INFO_BOX_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  neutral: { bg: 'var(--tab-bg)', border: 'transparent', color: 'var(--text)' },
  success: { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.25)', color: 'var(--text)' },
  warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', color: 'var(--text)' },
  error: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', color: '#EF4444' },
}

export function InfoBox({ children, variant = 'neutral' }: InfoBoxProps) {
  const s = INFO_BOX_STYLES[variant]
  return (
    <div
      className="rounded-xl p-3 text-sm leading-relaxed"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {children}
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  STATUS INDICATORS                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

/** Kleine dot + label */
export function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  )
}

/** Pill badge (bijv. risk level) */
export function StatusPill({ color, icon, label }: { color: string; icon: string; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  FEEDBACK STATES                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/** Spinner + tekst */
export function LoadingState({ text = 'Laden...' }: { text?: string }) {
  return (
    <div className="py-16 text-center">
      <div
        className="w-6 h-6 rounded-full border-2 border-t-transparent mx-auto mb-3 animate-spin"
        style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm" style={{ color: 'var(--muted)' }}>{text}</p>
    </div>
  )
}

/** Succes checkmark + titel + beschrijving */
export function SuccessState({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="py-12 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-5"
        style={{ backgroundColor: 'color-mix(in srgb, var(--brand) 12%, transparent)' }}
      >
        <span className="text-xl" style={{ color: 'var(--brand)' }}>✓</span>
      </div>
      <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>{title}</p>
      {description && (
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{description}</p>
      )}
      {children}
    </div>
  )
}

/** Empty state met emoji + tekst */
export function EmptyState({
  emoji,
  title,
  description,
  children,
}: {
  emoji?: string
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <div className="py-16 text-center">
      {emoji && <p className="text-3xl mb-3">{emoji}</p>}
      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>{title}</p>
      {description && (
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>{description}</p>
      )}
      {children}
    </div>
  )
}

/** Inline error bericht */
export function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      className="text-xs rounded-xl p-3"
      style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.08)' }}
    >
      {message}
    </p>
  )
}


/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SEGMENTED CONTROL (Tab toggle)                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Segmented control / toggle (lijst ↔ kalender, coach ↔ check, etc.)
 *
 * @example
 * <SegmentedControl
 *   options={[{ value: 'lijst', label: 'Lijst' }, { value: 'kalender', label: 'Kalender' }]}
 *   value={view}
 *   onChange={setView}
 * />
 */

interface SegmentedControlOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
}

export function SegmentedControl({ options, value, onChange, size = 'sm' }: SegmentedControlProps) {
  const padX = size === 'sm' ? 'px-2.5' : 'px-4'
  const padY = size === 'sm' ? 'py-1' : 'py-1.5'
  return (
    <div className="flex p-0.5 rounded-lg" style={{ backgroundColor: 'var(--tab-bg)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`${padX} ${padY} rounded-md text-xs font-medium transition-all capitalize`}
          style={{
            backgroundColor: value === opt.value ? 'var(--tab-active)' : 'transparent',
            color: value === opt.value ? 'var(--tab-active-text)' : 'var(--muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}