'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { unstable_rethrow, useRouter } from 'next/navigation'
import { saveContentText } from '@/app/edit-actions'
import { Spinner } from '@/components/submit-button'
import { primaryButtonClass, secondaryButtonClass } from '@/components/admin/styles'
import { normalizeNewlines } from '@/lib/text'

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'LI'])

const SAVE_FAILED = 'Could not save — check your connection and try again.'

const editorRingClass =
  'hover:ring-2 hover:ring-shpe-gold hover:ring-offset-2 hover:ring-offset-cmu-maroon focus:ring-2 focus:ring-shpe-gold focus:ring-offset-2 focus:ring-offset-cmu-maroon'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function textToHtml(text: string): string {
  const paragraphs = normalizeNewlines(text)
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return '<p><br></p>'
  return paragraphs.map((para) => `<p>${para.split('\n').map(escapeHtml).join('<br>')}</p>`).join('')
}

function domToText(root: HTMLElement): string {
  const blocks: string[] = []
  let current = ''
  const flush = () => {
    blocks.push(current)
    current = ''
  }
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      current += node.textContent ?? ''
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      current += '\n'
      return
    }
    const isBlock = BLOCK_TAGS.has(node.tagName)
    if (isBlock && current.trim()) flush()
    node.childNodes.forEach(visit)
    if (isBlock) flush()
  }
  root.childNodes.forEach(visit)
  flush()
  return blocks
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n'),
    )
    .filter(Boolean)
    .join('\n\n')
}

function renderInto(el: HTMLElement, value: string, multiline: boolean) {
  el.innerHTML = multiline ? textToHtml(value) : escapeHtml(value) || '<br>'
}

function blockFormatting(event: InputEvent) {
  if (event.inputType.startsWith('format')) event.preventDefault()
}

function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
  event.preventDefault()
  const text = event.clipboardData.getData('text/plain')
  document.execCommand('insertText', false, text)
}

export default function EditableText({
  contentKey,
  value,
  multiline,
  className,
  rootClassName,
  label,
}: {
  contentKey: string
  value: string
  multiline: boolean
  className: string
  rootClassName?: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Rendered once so the text shows before hydration; after that the effect owns the editor's DOM.
  const [initialText] = useState(value)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (ref.current) renderInto(ref.current, value, multiline)
  }, [value, multiline])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('beforeinput', blockFormatting)
    return () => el.removeEventListener('beforeinput', blockFormatting)
  }, [])

  const dirty = draft !== null && draft !== value

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = () => {
    if (draft === null || pending) return
    setError(null)
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof saveContentText>>
      try {
        result = await saveContentText(contentKey, draft)
      } catch (err) {
        unstable_rethrow(err)
        setError(SAVE_FAILED)
        return
      }
      if ('error' in result) {
        setError(result.error)
        return
      }
      ref.current?.focus()
      setDraft(null)
      router.refresh()
    })
  }

  const discard = () => {
    if (pending) return
    setDraft(null)
    setError(null)
    if (!ref.current) return
    renderInto(ref.current, value, multiline)
    ref.current.focus()
  }

  return (
    <div className={rootClassName}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={multiline}
        aria-label={label}
        spellCheck
        title="Click to edit"
        className={`${className} min-h-[1.5em] min-w-[3ch] cursor-text rounded-md outline-none transition ${editorRingClass}`}
        onInput={() => {
          const el = ref.current
          if (!el) return
          setDraft(multiline ? domToText(el) : (el.textContent ?? '').replace(/\s+/g, ' ').trim())
        }}
        onKeyDown={(event) => {
          if (!multiline && event.key === 'Enter') event.preventDefault()
        }}
        onPaste={handlePaste}
        onDrop={(event) => event.preventDefault()}
      >
        {initialText}
      </div>
      {dirty && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-left text-sm font-normal normal-case not-italic tracking-normal shadow-md">
          <button
            type="button"
            onClick={save}
            aria-disabled={pending}
            aria-busy={pending}
            className={`${primaryButtonClass} inline-flex items-center gap-2 transition active:scale-[0.97] aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            {pending && <Spinner />}
            {pending ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={discard}
            aria-disabled={pending}
            className={`${secondaryButtonClass} transition active:scale-[0.97] aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
          >
            Discard
          </button>
          {error ? (
            <span role="alert" className="text-red-700 dark:text-red-400">
              {error}
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              {multiline ? 'Enter starts a new line.' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
