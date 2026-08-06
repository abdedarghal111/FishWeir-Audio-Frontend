// Diff palabra a palabra entre el texto original y el que devuelve la IA, para
// que el modal de "Mejorar con IA" pueda mostrar qué ha cambiado antes de que
// el usuario decida aceptarlo. Implementación propia (LCS clásico) en vez de
// añadir una dependencia solo para esto — el texto de un guion de TTS es
// corto, así que el coste O(n·m) no es un problema real.

export type DiffPart = { type: 'equal' | 'insert' | 'delete'; text: string }

// Se separa conservando los espacios/saltos de línea como tokens propios
// (en vez de partir solo por palabras) para poder reconstruir el texto
// original byte a byte a partir de los tokens marcados como "equal".
function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}

export function diffWords(a: string, b: string): DiffPart[] {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  const n = tokensA.length
  const m = tokensB.length

  // lcs[i][j] = longitud de la subsecuencia común más larga entre
  // tokensA[i:] y tokensB[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = tokensA[i] === tokensB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const parts: DiffPart[] = []
  // Agrupa tokens consecutivos del mismo tipo en una sola parte, para no
  // trocear el resultado en cientos de <span> de una palabra cada uno.
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
