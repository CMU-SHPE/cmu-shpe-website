export function setInputFile(input: HTMLInputElement | null, file: File | null) {
  if (!input) return
  if (!file) {
    input.value = ''
    return
  }
  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
}
