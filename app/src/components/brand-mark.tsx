export function BrandMark({
  size = 44,
  className = '',
  decorative = false,
}: {
  size?: number
  className?: string
  decorative?: boolean
}) {
  return (
    <img
      className={`sr-logo-mark${className ? ` ${className}` : ''}`}
      src="/logo-mark-96.png"
      srcSet="/logo-mark-96.png 1x, /logo-mark-192.png 2x"
      alt={decorative ? '' : 'LemmaDeck'}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      draggable={false}
    />
  )
}
