'use client'

import { useState, FormEvent } from 'react'
import config from '@/lib/config'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function ContactForm({ email: contactEmail, subjects }: { email: string; subjects: string[] }) {
  const defaultSubject = subjects[0] ?? ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch(config.formspreeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <h3 className="font-bold text-green-800 dark:text-green-400 text-lg mb-1">Message Sent!</h3>
        <p className="text-green-700 dark:text-green-500 text-sm">
          Thanks for reaching out. We will get back to you within a few days.
        </p>
        <button
          onClick={() => {
            setStatus('idle')
            setName('')
            setEmail('')
            setSubject(defaultSubject)
            setMessage('')
          }}
          className="mt-4 text-green-700 dark:text-green-400 text-sm underline hover:text-green-900 dark:hover:text-green-300"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="name">
          Full Name <span className="text-shpe-red">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="email">
          Email Address <span className="text-shpe-red">*</span>
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="subject">
          Subject
        </label>
        <select
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition"
        >
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="message">
          Message <span className="text-shpe-red">*</span>
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message here..."
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {status === 'error' && (
        <p className="text-shpe-red text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          Something went wrong. Please try emailing us directly at {contactEmail}.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-shpe-red hover:bg-red-700 disabled:opacity-60 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200"
      >
        {status === 'loading' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}
