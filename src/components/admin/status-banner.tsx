const GENERIC_ERROR = 'Something went wrong. Please check the form and try again.'

export default function StatusBanner({
  saved,
  error,
  errorMessages,
  savedMessage = 'Saved.',
  live = true,
}: {
  saved?: string
  error?: string
  errorMessages: Record<string, string>
  savedMessage?: string
  /** Turn off when the caller moves focus to the banner, which already reads it out once. */
  live?: boolean
}) {
  if (error) {
    const message = Object.hasOwn(errorMessages, error) ? errorMessages[error] : GENERIC_ERROR
    return (
      <p
        role={live ? 'alert' : undefined}
        className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
      >
        {message}
      </p>
    )
  }

  if (saved) {
    return (
      <p
        role={live ? 'status' : undefined}
        className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-800 dark:text-green-400"
      >
        {savedMessage}
      </p>
    )
  }

  return null
}
