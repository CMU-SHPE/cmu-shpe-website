import { describe, expect, it } from 'vitest'
import { MAX_BIO_LENGTH, parseAdvisorForm, parseOfficerForm } from './person-schema'

function form(values: Record<string, string>) {
  const formData = new FormData()
  for (const [name, value] of Object.entries(values)) formData.set(name, value)
  return formData
}

const officer = {
  name: 'Jeff Torres Navarrete',
  role: 'Co-President',
  major: 'Mechanical Engineering',
  year: 'Junior',
  bio: 'Leading our chapter.',
  email: 'jytorresnavarr@mavs.coloradomesa.edu',
  linkedin: 'https://www.linkedin.com/in/jtorresn/',
  photoUrl: '/officers/jeff.jpg',
}

const advisor = {
  name: 'Ulises Techera',
  role: 'Instructor',
  department: 'CMU/CU Boulder Civil Engineering',
  bio: 'Advises the chapter.',
  email: 'utechera@coloradomesa.edu',
  linkedin: '',
  photoUrl: '',
}

describe('parseOfficerForm', () => {
  it('parses a complete officer', () => {
    expect(parseOfficerForm(form(officer)).data).toEqual(officer)
  })

  it('treats blank email, LinkedIn and photo path as none', () => {
    const parsed = parseOfficerForm(form({ ...officer, email: '', linkedin: ' ', photoUrl: '' }))
    expect(parsed.data).toMatchObject({ email: null, linkedin: null, photoUrl: null })
  })

  it('rejects a javascript: LinkedIn link', () => {
    expect(parseOfficerForm(form({ ...officer, linkedin: 'javascript:alert(1)' })).success).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(parseOfficerForm(form({ ...officer, email: 'jeff at cmu' })).success).toBe(false)
  })

  it('rejects a photo path that is neither root-relative nor http(s)', () => {
    expect(parseOfficerForm(form({ ...officer, photoUrl: 'data:image/png;base64,AAAA' })).success).toBe(false)
  })

  it('requires the name, role, major and year', () => {
    for (const field of ['name', 'role', 'major', 'year']) {
      expect(parseOfficerForm(form({ ...officer, [field]: ' ' })).success).toBe(false)
    }
  })

  it('allows an empty bio but caps its length', () => {
    expect(parseOfficerForm(form({ ...officer, bio: '' })).success).toBe(true)
    expect(parseOfficerForm(form({ ...officer, bio: 'a'.repeat(MAX_BIO_LENGTH + 1) })).success).toBe(false)
  })
})

describe('parseAdvisorForm', () => {
  it('parses an advisor with a department instead of major and year', () => {
    expect(parseAdvisorForm(form(advisor)).data).toEqual({ ...advisor, linkedin: null, photoUrl: null })
  })

  it('requires a department', () => {
    expect(parseAdvisorForm(form({ ...advisor, department: '' })).success).toBe(false)
  })
})
