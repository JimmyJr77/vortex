/** Thin grey line between sections in header and dropdown navigation panes. */
export const NAV_MENU_DIVIDER_CLASS = 'border-t border-gray-600'

interface NavMenuDividerProps {
  className?: string
}

const NavMenuDivider = ({ className = '' }: NavMenuDividerProps) => (
  <div
    className={className ? `${NAV_MENU_DIVIDER_CLASS} ${className}` : NAV_MENU_DIVIDER_CLASS}
    role="separator"
  />
)

export default NavMenuDivider
