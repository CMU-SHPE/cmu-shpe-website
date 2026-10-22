import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'

const mocks = vi.hoisted(() => ({
  saveContentText: vi.fn(),
  refresh: vi.fn(),
  rethrow: vi.fn(),
}))

vi.mock('@/app/edit-actions', () => ({ saveContentText: mocks.saveContentText }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  unstable_rethrow: mocks.rethrow,
}))

import Editable, { EditableList } from './editable'

beforeEach(() => {
  mocks.saveContentText.mockReset()
  mocks.refresh.mockReset()
  mocks.rethrow.mockReset()
})

function renderIntroEditor(value = 'Saved') {
  render(<Editable as="p" contentKey="home.hero.intro" value={value} editable className="intro" />)
  return screen.getByRole('textbox')
}

function typeInto(editor: HTMLElement, text: string) {
  editor.textContent = text
  fireEvent.input(editor)
}

describe('editor robustness', () => {
  it('keeps the draft and explains when the save request fails', async () => {
    const failure = new TypeError('Failed to fetch')
    mocks.saveContentText.mockRejectedValue(failure)
    const editor = renderIntroEditor()
    typeInto(editor, 'Draft text')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save — check your connection and try again.',
    )
    expect(mocks.rethrow).toHaveBeenCalledWith(failure)
    expect(editor).toHaveTextContent('Draft text')
    expect(await screen.findByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-busy', 'false')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('lets framework redirects, such as an expired session, through before handling the error', async () => {
    const redirectError = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' })
    mocks.saveContentText.mockRejectedValue(redirectError)
    const order: string[] = []
    mocks.rethrow.mockImplementation(() => order.push('rethrow'))
    const editor = renderIntroEditor()
    typeInto(editor, 'Draft')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByRole('alert')
    expect(mocks.rethrow).toHaveBeenCalledWith(redirectError)
    expect(order).toEqual(['rethrow'])
  })

  it('returns focus to the text after a successful save', async () => {
    mocks.saveContentText.mockResolvedValue({ ok: true })
    const editor = renderIntroEditor()
    typeInto(editor, 'New text')
    const save = screen.getByRole('button', { name: 'Save changes' })
    save.focus()

    fireEvent.click(save)

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull())
    expect(mocks.refresh).toHaveBeenCalled()
    expect(editor).toHaveFocus()
  })

  it('returns focus to the text after discarding', () => {
    const editor = renderIntroEditor()
    typeInto(editor, 'Draft')
    const discard = screen.getByRole('button', { name: 'Discard' })
    discard.focus()

    fireEvent.click(discard)

    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
    expect(editor).toHaveFocus()
  })

  it('blocks bold, italic and other formatting commands', () => {
    const editor = renderIntroEditor()
    for (const inputType of ['formatBold', 'formatItalic', 'formatUnderline']) {
      const event = new InputEvent('beforeinput', { inputType, bubbles: true, cancelable: true })
      expect(editor.dispatchEvent(event), inputType).toBe(false)
    }
    const typing = new InputEvent('beforeinput', { inputType: 'insertText', data: 'a', bubbles: true, cancelable: true })
    expect(editor.dispatchEvent(typing)).toBe(true)
  })

  it('ignores dropped content', () => {
    const editor = renderIntroEditor()
    expect(fireEvent.drop(editor)).toBe(false)
  })
})

describe('Editable signed out', () => {
  it('renders the original element with its classes and plain text', () => {
    const { container } = render(
      <Editable
        as="h2"
        contentKey="home.mission.heading"
        value="Building the Future"
        editable={false}
        className="text-4xl font-bold"
      />,
    )
    expect(container.innerHTML).toBe('<h2 class="text-4xl font-bold">Building the Future</h2>')
  })

  it('escapes markup stored in the database', () => {
    const { container } = render(
      <Editable
        as="p"
        contentKey="home.hero.intro"
        value={'<img src=x onerror="alert(1)">'}
        editable={false}
        className="intro"
      />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('<img src=x onerror="alert(1)">')
  })

  it('renders each line of a multiline key separated by <br>', () => {
    const { container } = render(
      <Editable
        as="p"
        contentKey="footer.tagline"
        value={'Society of Hispanic Professional Engineers\nColorado Mesa University Chapter'}
        editable={false}
        className="tagline"
      />,
    )
    expect(container.innerHTML).toBe(
      '<p class="tagline">Society of Hispanic Professional Engineers<br>Colorado Mesa University Chapter</p>',
    )
  })

  it('keeps leading decoration inside the element', () => {
    const { container } = render(
      <Editable
        as="h3"
        contentKey="about.values.heading"
        value="Our Values"
        editable={false}
        className="heading"
        leading={<span className="bar" />}
      />,
    )
    expect(container.innerHTML).toBe('<h3 class="heading"><span class="bar"></span>Our Values</h3>')
  })
})

describe('Editable signed in', () => {
  it('replaces the element with a labelled editor instead of nesting inside it', () => {
    const { container } = render(
      <Editable
        as="h2"
        contentKey="home.mission.heading"
        value="Building the Future"
        editable
        className="text-4xl font-bold"
      />,
    )
    const editor = screen.getByRole('textbox', { name: 'Home: mission heading' })
    expect(editor).toHaveTextContent('Building the Future')
    expect(editor).toHaveClass('text-4xl', 'font-bold')
    expect(container.querySelector('h2')).toBeNull()
  })

  it('keeps the heading level around the editor for h1 to h3', () => {
    render(
      <>
        <Editable as="h1" contentKey="about.header.heading" value="About Our Chapter" editable className="title" />
        <Editable as="h2" contentKey="about.chapter.heading" value="Chapter" editable className="section" />
        <Editable
          as="h3"
          contentKey="about.values.heading"
          value="Our Values"
          editable
          className="flex items-center"
          leading={<span className="bar" />}
        />
      </>,
    )
    const [h1, h2, h3] = [1, 2, 3].map((level) => screen.getByRole('heading', { level }))
    expect(h1).toContainElement(screen.getByRole('textbox', { name: 'About: page title' }))
    expect(h2).toContainElement(screen.getByRole('textbox', { name: 'About: chapter heading' }))
    expect(h3).toContainElement(screen.getByRole('textbox', { name: 'About: values heading' }))
    expect(h3).toHaveClass('flex', 'items-center')
    expect(h1).toHaveAccessibleName('About Our Chapter')
  })

  it('keeps a heading named by its text alone while there are unsaved edits', () => {
    render(
      <>
        <Editable as="h2" contentKey="about.chapter.heading" value="Chapter" editable className="section" />
        <Editable
          as="h3"
          contentKey="about.values.heading"
          value="Our Values"
          editable
          className="flex items-center"
          leading={<span className="bar" />}
        />
      </>,
    )
    for (const [level, label] of [
      [2, 'About: chapter heading'],
      [3, 'About: values heading'],
    ] as const) {
      const editor = screen.getByRole('textbox', { name: label })
      editor.textContent = `Edited ${level}`
      fireEvent.input(editor)

      const heading = screen.getByRole('heading', { level })
      expect(heading).toHaveAccessibleName(`Edited ${level}`)
      expect(within(heading).queryByRole('button')).toBeNull()
    }
    expect(screen.getAllByRole('button', { name: 'Save changes' })).toHaveLength(2)
  })

  it('does not add a heading role around paragraph editors', () => {
    render(<Editable as="p" contentKey="home.hero.intro" value="Intro" editable className="intro" />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('server-renders the saved text, escaped, so it shows before hydration', () => {
    const html = renderToString(
      <Editable as="p" contentKey="home.hero.intro" value="Fish & <b>chips</b>" editable className="intro" />,
    )
    expect(html).toContain('Fish &amp; &lt;b&gt;chips&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })

  it('shows the new value after the page refreshes with saved text', () => {
    const { rerender } = render(
      <Editable as="p" contentKey="home.hero.intro" value="Before" editable className="intro" />,
    )
    rerender(<Editable as="p" contentKey="home.hero.intro" value="After" editable className="intro" />)
    expect(screen.getByRole('textbox')).toHaveTextContent(/^After$/)
  })

  it('sets stored text as escaped HTML in the editor', () => {
    render(
      <Editable as="p" contentKey="home.hero.intro" value="<b>bold</b>" editable className="intro" />,
    )
    const editor = screen.getByRole('textbox')
    expect(editor.querySelector('b')).toBeNull()
    expect(editor).toHaveTextContent('<b>bold</b>')
  })

  it('saves an edit, then refreshes the page', async () => {
    mocks.saveContentText.mockResolvedValue({ ok: true })
    render(<Editable as="p" contentKey="home.hero.intro" value="Old text" editable className="intro" />)

    const editor = screen.getByRole('textbox')
    editor.textContent = '  New   text '
    fireEvent.input(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.saveContentText).toHaveBeenCalledWith('home.hero.intro', 'New text')
  })

  it('shows the server error and keeps the toolbar open', async () => {
    mocks.saveContentText.mockResolvedValue({ error: 'Too long' })
    render(<Editable as="p" contentKey="home.hero.intro" value="Old" editable className="intro" />)

    const editor = screen.getByRole('textbox')
    editor.textContent = 'New'
    fireEvent.input(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too long')
    expect(await screen.findByRole('button', { name: 'Save changes' })).toHaveAttribute('aria-busy', 'false')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('marks Save busy while the request is in flight', async () => {
    let resolveSave: (value: { ok: true }) => void
    mocks.saveContentText.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve
      }),
    )
    render(<Editable as="p" contentKey="home.hero.intro" value="Old" editable className="intro" />)

    const editor = screen.getByRole('textbox')
    editor.textContent = 'New'
    fireEvent.input(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const busy = await screen.findByRole('button', { name: /Saving/ })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    await act(async () => resolveSave!({ ok: true }))
  })

  it('discards an edit and restores the saved text', () => {
    render(<Editable as="p" contentKey="home.hero.intro" value="Saved" editable className="intro" />)

    const editor = screen.getByRole('textbox')
    editor.textContent = 'Draft'
    fireEvent.input(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(editor).toHaveTextContent('Saved')
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('blocks Enter in a single-line field', () => {
    render(<Editable as="p" contentKey="home.hero.intro" value="Text" editable className="intro" />)
    const event = fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(event).toBe(false)
  })
})

describe('EditableList', () => {
  const renderItem = (item: string) => <li className="item">{item}</li>

  it('renders one list item per non-empty line when signed out', () => {
    const { container } = render(
      <EditableList
        contentKey="about.values.items"
        value={'First\n\nSecond\n'}
        editable={false}
        className="space-y-3"
        editorClassName="editor"
        renderItem={renderItem}
      />,
    )
    expect(container.innerHTML).toBe(
      '<ul class="space-y-3"><li class="item">First</li><li class="item">Second</li></ul>',
    )
  })

  it('renders a multiline editor in place of the list when signed in', () => {
    const { container } = render(
      <EditableList
        contentKey="about.values.items"
        value={'First\nSecond'}
        editable
        className="space-y-3"
        editorClassName="editor"
        renderItem={renderItem}
      />,
    )
    expect(container.querySelector('ul')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'About: values, one per line' })).toHaveAttribute(
      'aria-multiline',
      'true',
    )
  })
})

describe('multiline editor', () => {
  function renderValuesEditor(value: string) {
    render(
      <EditableList
        contentKey="about.values.items"
        value={value}
        editable
        className="space-y-3"
        editorClassName="editor"
        renderItem={(item) => <li>{item}</li>}
      />,
    )
    return screen.getByRole('textbox', { name: 'About: values, one per line' })
  }

  async function saveEdit(editor: HTMLElement, html: string) {
    mocks.saveContentText.mockResolvedValue({ ok: true })
    editor.innerHTML = html
    fireEvent.input(editor)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    return mocks.saveContentText.mock.calls[0]
  }

  it('does not report unsaved changes when stored lines and paragraphs are left as they are', () => {
    const editor = renderValuesEditor('First\nSecond\n\nThird')
    fireEvent.input(editor)
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('shows markup in a stored line as text', () => {
    const editor = renderValuesEditor('Safe\n<img src=x onerror=alert(1)>')
    expect(editor.querySelector('img')).toBeNull()
    expect(editor).toHaveTextContent('Safe<img src=x onerror=alert(1)>')
  })

  it('saves a paragraph the browser adds on Enter as a new item after a blank line', async () => {
    const editor = renderValuesEditor('First\nSecond')
    expect(await saveEdit(editor, '<p>First<br>Second</p><p>Third</p>')).toEqual([
      'about.values.items',
      'First\nSecond\n\nThird',
    ])
  })

  it('saves text before a browser-inserted <div> line as its own item', async () => {
    const editor = renderValuesEditor('First')
    expect(await saveEdit(editor, 'First<div>Second</div>')).toEqual(['about.values.items', 'First\n\nSecond'])
  })

  it('drops empty paragraphs and collapses runs of spaces within a line', async () => {
    const editor = renderValuesEditor('First')
    expect(await saveEdit(editor, '<p>  First   item </p><p><br></p><p>Second</p>')).toEqual([
      'about.values.items',
      'First item\n\nSecond',
    ])
  })
})
