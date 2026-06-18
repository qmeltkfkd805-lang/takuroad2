'use client'

import { useEffect, useRef, ReactNode } from 'react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  maxHeight?: string
}

export default function BottomSheet({
  isOpen,
  onClose,
  children,
  maxHeight = '85dvh',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose])

  // ESC 키
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <>
      {/* 딤 배경 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,.3)',
          zIndex: 200,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity .25s',
        }}
      />

      {/* 시트 */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight,
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: 'var(--sh-lg)',
          zIndex: 201,
          overflowY: 'auto',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform .3s cubic-bezier(.32,.72,0,1)',
        }}
      >
        {/* 핸들 */}
        <div style={{
          width: '36px',
          height: '4px',
          background: 'var(--border)',
          borderRadius: '2px',
          margin: '12px auto 0',
        }} />

        {children}
      </div>
    </>
  )
}
