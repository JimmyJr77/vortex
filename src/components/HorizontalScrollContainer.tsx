import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'

const DRAG_THRESHOLD_PX = 5

interface HorizontalScrollContainerProps {
  children: ReactNode
  className?: string
  innerClassName?: string
  /** Show gradient fades when content overflows horizontally */
  fadeEdges?: boolean
  /** Tailwind `from-*` color for fade gradients (matches parent background) */
  fadeFromClassName?: string
}

export default function HorizontalScrollContainer({
  children,
  className = '',
  innerClassName = '',
  fadeEdges = true,
  fadeFromClassName = 'from-gray-900',
}: HorizontalScrollContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isGrabbing, setIsGrabbing] = useState(false)

  const updateScrollAffordance = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 1)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollAffordance()

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      el.scrollLeft += event.deltaY
    }

    el.addEventListener('scroll', updateScrollAffordance, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })

    const resizeObserver = new ResizeObserver(updateScrollAffordance)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', updateScrollAffordance)
      el.removeEventListener('wheel', onWheel)
      resizeObserver.disconnect()
    }
  }, [updateScrollAffordance])

  const onMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const el = scrollRef.current
    if (!el) return

    dragRef.current = {
      active: true,
      startX: event.pageX,
      scrollLeft: el.scrollLeft,
      moved: false,
    }

    const onMouseMove = (moveEvent: globalThis.MouseEvent) => {
      if (!dragRef.current.active) return

      const deltaX = moveEvent.pageX - dragRef.current.startX
      if (!dragRef.current.moved && Math.abs(deltaX) > DRAG_THRESHOLD_PX) {
        dragRef.current.moved = true
        setIsGrabbing(true)
      }

      if (dragRef.current.moved) {
        el.scrollLeft = dragRef.current.scrollLeft - deltaX
      }
    }

    const onMouseUp = () => {
      dragRef.current.active = false
      setIsGrabbing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      event.preventDefault()
      event.stopPropagation()
      dragRef.current.moved = false
    }
  }

  const fadeBase = `pointer-events-none absolute inset-y-0 z-10 w-10 ${fadeFromClassName}`

  return (
    <div className={`relative ${className}`}>
      {fadeEdges && canScrollLeft && (
        <div
          className={`${fadeBase} left-0 bg-gradient-to-r to-transparent`}
          aria-hidden
        />
      )}
      {fadeEdges && canScrollRight && (
        <div
          className={`${fadeBase} right-0 bg-gradient-to-l to-transparent`}
          aria-hidden
        />
      )}
      <div
        ref={scrollRef}
        className={`overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
          isGrabbing ? 'cursor-grabbing select-none' : 'cursor-grab'
        } ${innerClassName}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
        onMouseDown={onMouseDown}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
    </div>
  )
}
