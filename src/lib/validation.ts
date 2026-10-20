import { z } from 'zod'

export const imageSource = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value.startsWith('/')
        ? !value.startsWith('//')
        : /^https?:\/\//i.test(value) && URL.canParse(value),
    { message: 'Must be an absolute http(s) URL or a root-relative path' },
  )
