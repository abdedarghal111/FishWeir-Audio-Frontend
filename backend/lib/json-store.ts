// Helper genérico para persistir un array como JSON en disco: mismo patrón
// que loadPersisted/savePersisted en frontend/src/lib/types.ts, pero para el
// backend. Cada dominio (favoritos, historial de generaciones, voces
// compartidas) tenía su propio par read/write casi idéntico repetido en
// server.ts; esto los reemplaza sin imponer nada más que "es un array en un
// archivo JSON".
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function createJsonStore<T>(filePath: string) {
  async function read(): Promise<T[]> {
    try {
      return JSON.parse(await readFile(filePath, 'utf-8'))
    } catch {
      return []
    }
  }

  async function write(items: T[]) {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, JSON.stringify(items, null, 2))
  }

  return { read, write }
}
