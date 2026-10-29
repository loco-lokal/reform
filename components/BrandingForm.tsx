'use client'

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { resetBrandingAction, saveBrandingAction, type BrandingState } from '@/app/admin/actions'
import {
  COLOR_KEYS,
  DEFAULT_BRANDING,
  FONTS,
  FONT_IDS,
  LIMITS,
  brandingStyle,
  type AssetKind,
  type BrandingSettings,
  type ColorKey,
} from '@/lib/branding'
import type { BrandingKey } from '@/lib/i18n'

type Labels = Record<BrandingKey, string>

const COLOR_LABELS: Record<ColorKey, [BrandingKey, BrandingKey?]> = {
  accent: ['brandingAccent', 'brandingAccentHelp'],
  onAccent: ['brandingOnAccent'],
  accentText: ['brandingAccentText', 'brandingAccentTextHelp'],
  ink: ['brandingInk'],
  paper: ['brandingPaper'],
  canvas: ['brandingCanvas'],
  muted: ['brandingMuted'],
}

const WEIGHTS = [400, 500, 600, 700, 800, 900]
const FULL_HEX = /^#[0-9a-f]{6}$/i

export function BrandingForm({
  initial,
  images,
  labels,
}: {
  initial: BrandingSettings
  images: Partial<Record<AssetKind, string>>
  labels: Labels
}) {
  const [state, action, pending] = useActionState<BrandingState, FormData>(saveBrandingAction, {})
  const [values, setValues] = useState(initial)
  const [resetting, startReset] = useTransition()
  const [resetDone, setResetDone] = useState(false)
  const errors = state.fields ?? {}
  const formRef = useRef<HTMLFormElement>(null)

  // Saved images are now shown as current: clear the file pickers and "remove" boxes.
  useEffect(() => {
    if (!state.saved) return
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="file"]').forEach((input) => (input.value = ''))
    formRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => (input.checked = false))
  }, [state])

  // Dispatched by hand: a form `action` makes React reset the form afterwards, and controlled selects
  // would then show their initial options instead of the saved ones.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResetDone(false)
    const data = new FormData(event.currentTarget)
    startTransition(() => action(data))
  }

  const set = (patch: Partial<BrandingSettings>) => setValues((v) => ({ ...v, ...patch }))
  const setColor = (key: ColorKey, value: string) => set({ colors: { ...values.colors, [key]: value } })
  const setType = (patch: Partial<BrandingSettings['typography']>) => set({ typography: { ...values.typography, ...patch } })

  function reset() {
    if (!window.confirm(labels.brandingResetConfirm)) return
    startReset(async () => {
      await resetBrandingAction()
      setValues(DEFAULT_BRANDING)
      setResetDone(true)
    })
  }

  return (
    <div className="rf-branding">
      <form ref={formRef} className="rf-contact-form" onSubmit={submit}>
        {state.error && (
          <p className="rf-contact-status" data-state="error" role="alert">
            {state.error}
          </p>
        )}
        {(state.saved || resetDone) && !pending && (
          <p className="rf-contact-status" data-state="success" role="status">
            {labels.brandingSaved}
          </p>
        )}

        <Section title={labels.brandingIdentity}>
          <Field id="name" label={labels.brandingName} help={labels.brandingNameHelp} error={errors.name}>
            <input
              id="name"
              name="name"
              required
              maxLength={LIMITS.nameMax}
              value={values.name}
              onChange={(e) => set({ name: e.target.value })}
              aria-invalid={!!errors.name}
            />
          </Field>
          <Field id="siteUrl" label={labels.brandingSiteUrl} help={labels.brandingSiteUrlHelp} error={errors.siteUrl}>
            <input
              id="siteUrl"
              name="siteUrl"
              type="text"
              inputMode="url"
              placeholder="https://example.com"
              value={values.siteUrl ?? ''}
              onChange={(e) => set({ siteUrl: e.target.value })}
              aria-invalid={!!errors.siteUrl}
            />
          </Field>
        </Section>

        <Section title={labels.brandingImages}>
          <div className="rf-branding-grid">
            <ImageField kind="logo" label={labels.brandingLogo} help={labels.brandingLogoHelp} url={images.logo} labels={labels} error={errors.logo} />
            <ImageField kind="icon" label={labels.brandingIcon} help={labels.brandingIconHelp} url={images.icon} labels={labels} error={errors.icon} />
          </div>
        </Section>

        <Section title={labels.brandingColors}>
          <div className="rf-branding-grid">
            {COLOR_KEYS.map((key) => {
              const [label, help] = COLOR_LABELS[key]
              const value = values.colors[key]
              return (
                <Field key={key} id={key} label={labels[label]} help={help && labels[help]} error={errors[key]}>
                  <div className="rf-color">
                    <input
                      type="color"
                      aria-label={labels[label]}
                      value={FULL_HEX.test(value) ? value.toLowerCase() : '#000000'}
                      onChange={(e) => setColor(key, e.target.value)}
                    />
                    <input
                      id={key}
                      name={key}
                      required
                      pattern="#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})"
                      spellCheck={false}
                      value={value}
                      onChange={(e) => setColor(key, e.target.value)}
                      aria-invalid={!!errors[key]}
                    />
                  </div>
                </Field>
              )
            })}
          </div>
        </Section>

        <Section title={labels.brandingTypography}>
          <div className="rf-branding-grid">
            <Field id="displayFont" label={labels.brandingDisplayFont} error={errors.displayFont}>
              <FontSelect id="displayFont" value={values.typography.displayFont} onChange={(displayFont) => setType({ displayFont })} />
            </Field>
            <Field id="bodyFont" label={labels.brandingBodyFont} error={errors.bodyFont}>
              <FontSelect id="bodyFont" value={values.typography.bodyFont} onChange={(bodyFont) => setType({ bodyFont })} />
            </Field>
            <Field id="displayWeight" label={labels.brandingDisplayWeight} error={errors.displayWeight}>
              <select
                id="displayWeight"
                name="displayWeight"
                value={values.typography.displayWeight}
                onChange={(e) => setType({ displayWeight: Number(e.target.value) })}
              >
                {WEIGHTS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="baseSize" label={`${labels.brandingBaseSize}: ${values.typography.baseSize}px`} error={errors.baseSize}>
              <input
                id="baseSize"
                name="baseSize"
                type="range"
                min={LIMITS.baseSize.min}
                max={LIMITS.baseSize.max}
                step={1}
                value={values.typography.baseSize}
                onChange={(e) => setType({ baseSize: Number(e.target.value) })}
              />
            </Field>
            <Field
              id="headingScale"
              label={`${labels.brandingHeadingScale}: ${Math.round(values.typography.headingScale * 100)}%`}
              error={errors.headingScale}
            >
              <input
                id="headingScale"
                name="headingScale"
                type="range"
                min={LIMITS.headingScale.min}
                max={LIMITS.headingScale.max}
                step={0.05}
                value={values.typography.headingScale}
                onChange={(e) => setType({ headingScale: Number(e.target.value) })}
              />
            </Field>
          </div>
        </Section>

        <div className="rf-actions">
          <button className="rf-button" data-tone="accent" type="submit" disabled={pending || resetting}>
            {pending ? labels.brandingSaving : labels.brandingSave}
          </button>
          <button className="rf-button" data-tone="soft" type="button" onClick={reset} disabled={pending || resetting}>
            {labels.brandingReset}
          </button>
        </div>
      </form>

      <Preview values={values} logo={images.logo} labels={labels} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rf-branding-section">
      <legend className="rf-display">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({ id, label, help, error, children }: { id: string; label: string; help?: string; error?: string; children: ReactNode }) {
  return (
    <div className="rf-contact-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {help && <small className="rf-field-help">{help}</small>}
      {error && <span className="rf-field-error">{error}</span>}
    </div>
  )
}

function FontSelect({ id, value, onChange }: { id: string; value: keyof typeof FONTS; onChange: (font: keyof typeof FONTS) => void }) {
  return (
    <select id={id} name={id} value={value} onChange={(e) => onChange(e.target.value as keyof typeof FONTS)}>
      {FONT_IDS.map((font) => (
        <option key={font} value={font} style={{ fontFamily: FONTS[font].family }}>
          {FONTS[font].label}
        </option>
      ))}
    </select>
  )
}

function ImageField({
  kind,
  label,
  help,
  url,
  labels,
  error,
}: {
  kind: AssetKind
  label: string
  help: string
  url?: string
  labels: Labels
  error?: string
}) {
  return (
    <Field id={kind} label={label} help={help} error={error}>
      <div className="rf-asset">
        <span className="rf-asset-preview" title={url ? labels.brandingCurrent : labels.brandingNone}>
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded image of any format */}
          <img src={url ?? '/favicon.svg'} alt="" />
        </span>
        <input id={kind} name={kind} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,.ico" />
      </div>
      {url && (
        <label className="rf-asset-remove">
          <input type="checkbox" name={`${kind}Remove`} /> {labels.brandingRemove}
        </label>
      )}
    </Field>
  )
}

/** Live preview with the edited, not yet saved values applied as tokens. */
function Preview({ values, logo, labels }: { values: BrandingSettings; logo?: string; labels: Labels }) {
  const style = { ...brandingStyle(values), fontSize: `${values.typography.baseSize}px` } as CSSProperties
  return (
    <aside className="rf-branding-preview" aria-label={labels.brandingPreview}>
      <span className="rf-contact-eyebrow">{labels.brandingPreview}</span>
      <div className="rf-preview" style={style}>
        <div className="rf-preview-nav">
          {/* eslint-disable-next-line @next/next/no-img-element -- uploaded image of any format */}
          <img src={logo ?? '/favicon.svg'} alt="" />
          {values.name}
        </div>
        <div className="rf-preview-card">
          <span className="rf-preview-eyebrow">{values.name}</span>
          <strong className="rf-display rf-preview-title">{labels.brandingPreviewTitle}</strong>
          <p className="rf-preview-text">{labels.brandingPreviewText}</p>
          <span className="rf-preview-option">{labels.brandingPreviewOption}</span>
          <span className="rf-preview-button">{labels.brandingSave}</span>
        </div>
      </div>
    </aside>
  )
}
