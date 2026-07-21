'use client'
import { useState } from 'react'
import ContactForm from './ContactForm'
import MyContacts from './MyContacts'

export default function ContactSection() {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <>
      <ContactForm onSent={() => setRefreshKey(k => k + 1)} />
      <MyContacts refreshKey={refreshKey} />
    </>
  )
}