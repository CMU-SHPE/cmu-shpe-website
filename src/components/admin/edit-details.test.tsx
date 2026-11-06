import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import EditDetails from './edit-details'

describe('EditDetails', () => {
  it('names what it edits for screen readers, with a space after Edit', () => {
    const { container } = render(
      <EditDetails name="Chapter meeting on January 1, 2099">
        <p>Form</p>
      </EditDetails>,
    )
    expect(container.querySelector('summary')).toHaveAccessibleName('Edit Chapter meeting on January 1, 2099')
  })
})
