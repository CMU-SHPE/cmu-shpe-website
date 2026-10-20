import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HTTP_URL_INPUT, IMAGE_SOURCE_INPUT } from '@/lib/form-fields'
import PersonFields from './person-fields'

describe('PersonFields', () => {
  it('checks the LinkedIn link and photo path in the browser with the server rules', () => {
    render(
      <form>
        <PersonFields>{null}</PersonFields>
      </form>,
    )
    const linkedin = screen.getByLabelText('LinkedIn profile URL (optional)')
    expect(linkedin).toHaveAttribute('pattern', HTTP_URL_INPUT.pattern)
    expect(linkedin).toHaveAttribute('title', HTTP_URL_INPUT.title)

    const photoPath = screen.getByLabelText('Photo path or URL (optional — ignored when you upload a file)')
    expect(photoPath).toHaveAttribute('pattern', IMAGE_SOURCE_INPUT.pattern)
    expect(photoPath).toHaveAttribute('title', IMAGE_SOURCE_INPUT.title)
  })
})
