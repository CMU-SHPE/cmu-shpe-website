import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  saveContentText: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/app/edit-actions', () => ({ saveContentText: mocks.saveContentText }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))

import Editable, { EditableList } from './editable'

beforeEach(() => {
  mocks.saveContentText.mockReset()
  mocks.refresh.mockReset()
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
