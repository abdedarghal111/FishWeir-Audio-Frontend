// Diff palabra a palabra para el modal "Mejorar con IA". LCS clásico implementado a mano
// en vez de una dependencia — el texto de un guion TTS es corto, O(n·m) no es problema.

export type DiffPart = { type: 'equal' | 'insert' | 'delete'; text: string }

// Los espacios y saltos de línea se conservan como tokens independientes para poder
// reconstruir el texto original a partir de los tokens de tipo "equal".
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}

export function diffWords(a: string, b: string): DiffPart[] {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  const n = tokensA.length
  const m = tokensB.length

  // lcs[i][j] = longitud de la subsecuencia común más larga entre tokensA[i:] y tokensB[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = tokensA[i] === tokensB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const parts: DiffPart[] = []
  // Agrupa tokens consecutivos del mismo tipo para evitar generar cientos de <span> al renderizar.
  function push(type: DiffPart['type'], text: string) {
    const last = parts[parts.length - 1]
    if (last && last.type === type) last.text += text
    else parts.push({ type, text })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (tokensA[i] === tokensB[j]) {
      push('equal', tokensA[i])
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('delete', tokensA[i])
      i++
    } else {
      push('insert', tokensB[j])
      j++
    }
  }
  while (i < n) push('delete', tokensA[i++])
  while (j < m) push('insert', tokensB[j++])

  return parts
}
