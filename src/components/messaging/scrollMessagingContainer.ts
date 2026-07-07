/** Nearest ancestor that can scroll vertically. */
export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

/** Scroll the message list container without moving the portal page under the header. */
export function scrollToEndWithinContainer(
  endEl: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth',
): void {
  if (!endEl) return
  const scroller = getScrollParent(endEl)
  if (scroller) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior })
    return
  }
  endEl.scrollIntoView({ behavior, block: 'nearest' })
}
