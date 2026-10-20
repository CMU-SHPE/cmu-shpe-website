import { Fragment } from 'react'
import EditableText from '@/components/editable-text'
import { type InlineContentKey, contentKeyDefinition } from '@/lib/content-keys'
import { toLines } from '@/lib/lines'

type EditableTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'cite' | 'div'

const HEADING_LEVELS: Partial<Record<EditableTag, number>> = { h1: 1, h2: 2, h3: 3 }

/**
 * Signed out, renders the page's own element with plain text. Signed in, the
 * editor replaces the element rather than nesting inside it, because a block
 * editor inside a heading or paragraph is invalid HTML and breaks hydration;
 * a heading keeps its level through role="heading" on a wrapping div.
 */
export default function Editable({
  as: Tag,
  contentKey,
  value,
  editable,
  className,
  leading,
}: {
  as: EditableTag
  contentKey: InlineContentKey
  value: string
  editable: boolean
  className: string
  leading?: React.ReactNode
}) {
  const { label, multiline } = contentKeyDefinition(contentKey)

  if (editable) {
    const level = HEADING_LEVELS[Tag]
    const heading = level ? { role: 'heading', 'aria-level': level } : {}
    const editor = (
      <EditableText
        contentKey={contentKey}
        value={value}
        multiline={multiline}
        label={label}
        className={leading ? '' : className}
        rootClassName={leading ? 'min-w-0 flex-1' : undefined}
      />
    )
    if (leading) {
      return (
        <div className={className} {...heading}>
          {leading}
          {editor}
        </div>
      )
    }
    return level ? <div {...heading}>{editor}</div> : editor
  }

  return (
    <Tag className={className}>
      {leading}
      {multiline
        ? toLines(value).map((line, index) => (
            <Fragment key={index}>
              {index > 0 && <br />}
              {line}
            </Fragment>
          ))
        : value}
    </Tag>
  )
}

export function EditableList({
  contentKey,
  value,
  editable,
  className,
  editorClassName,
  renderItem,
}: {
  contentKey: InlineContentKey
  value: string
  editable: boolean
  className: string
  editorClassName: string
  renderItem: (item: string) => React.ReactNode
}) {
  if (editable) {
    const { label } = contentKeyDefinition(contentKey)
    return (
      <EditableText
        contentKey={contentKey}
        value={value}
        multiline
        label={label}
        className={editorClassName}
      />
    )
  }

  return (
    <ul className={className}>
      {toLines(value).map((item, index) => (
        <Fragment key={index}>{renderItem(item)}</Fragment>
      ))}
    </ul>
  )
}
