export type VisualViewportBox = {
  offsetLeft: number
  offsetTop: number
  width: number
  height: number
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

export function visualViewportVariables(box: VisualViewportBox) {
  return {
    '--sr-visual-left': `${Math.max(0, finite(box.offsetLeft, 0))}px`,
    '--sr-visual-top': `${Math.max(0, finite(box.offsetTop, 0))}px`,
    '--sr-visual-width': `${Math.max(1, finite(box.width, 1))}px`,
    '--sr-visual-height': `${Math.max(1, finite(box.height, 1))}px`,
  }
}
