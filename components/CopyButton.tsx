'use client'

import { useState } from 'react'

export function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button type="button" className="rf-button" data-tone="accent" onClick={copy}>
      {copied ? copiedLabel : label}
    </button>
  )
}
