// Spreadsheet apps treat a cell starting with these as a formula, and some skip leading whitespace first.
const FORMULA_START = /^\s*[=+\-@\t\r]/

export function csvField(value: string | number | null): string {
  if (value == null) return ''
  let text = String(value)
  if (FORMULA_START.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function csvRow(values: (string | number | null)[]): string {
  return values.map(csvField).join(',')
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((row) => `${csvRow(row)}\r\n`).join('')
}
