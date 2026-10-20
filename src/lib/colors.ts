export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const DEFAULT_LOGO_BACKGROUND = '#ffffff'

export function safeHexColor(value: string | null | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value : fallback
}
