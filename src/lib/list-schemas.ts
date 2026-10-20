import { z } from 'zod'
import { BENEFIT_COLUMNS, MAX_BENEFIT_TEXT_LENGTH } from './benefit-cells'
import { requiredText } from './form-fields'

export const LIST_NAMES = ['homeStats', 'homePillars', 'nationalStats', 'sponsorBenefits'] as const

export const listName = z.enum(LIST_NAMES)

export type ListName = z.infer<typeof listName>

export const MAX_LIST_DESCRIPTION_LENGTH = 500

const description = z.string().trim().max(MAX_LIST_DESCRIPTION_LENGTH)

export const homeStatSchema = z.object({
  value: requiredText(50),
  label: requiredText(100),
})

export const homePillarSchema = z.object({
  icon: requiredText(16),
  title: requiredText(100),
  description,
})

export const nationalStatSchema = z.object({
  value: requiredText(50),
  label: requiredText(100),
  description,
})

const benefitCell = z
  .discriminatedUnion('mode', [
    z.object({ mode: z.literal('yes') }),
    z.object({ mode: z.literal('no') }),
    z.object({ mode: z.literal('custom'), text: requiredText(MAX_BENEFIT_TEXT_LENGTH) }),
  ])
  .transform((cell) => (cell.mode === 'custom' ? cell.text : cell.mode))

export const benefitSchema = z.object({
  label: requiredText(200),
  platinum: benefitCell,
  gold: benefitCell,
  silver: benefitCell,
  bronze: benefitCell,
})

export function parseHomeStatForm(formData: FormData) {
  return homeStatSchema.safeParse({
    value: formData.get('value'),
    label: formData.get('label'),
  })
}

export function parseHomePillarForm(formData: FormData) {
  return homePillarSchema.safeParse({
    icon: formData.get('icon'),
    title: formData.get('title'),
    description: formData.get('description'),
  })
}

export function parseNationalStatForm(formData: FormData) {
  return nationalStatSchema.safeParse({
    value: formData.get('value'),
    label: formData.get('label'),
    description: formData.get('description'),
  })
}

function cellInput(formData: FormData, column: string) {
  return { mode: formData.get(`${column}Mode`), text: formData.get(`${column}Text`) }
}

export function parseBenefitForm(formData: FormData) {
  return benefitSchema.safeParse({
    label: formData.get('label'),
    platinum: cellInput(formData, BENEFIT_COLUMNS.Platinum),
    gold: cellInput(formData, BENEFIT_COLUMNS.Gold),
    silver: cellInput(formData, BENEFIT_COLUMNS.Silver),
    bronze: cellInput(formData, BENEFIT_COLUMNS.Bronze),
  })
}
