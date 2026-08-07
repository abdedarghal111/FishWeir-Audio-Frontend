// Persiste un array como JSON en disco; sustituye los pares read/write casi
// idénticos que antes se repetían por dominio (favoritos, historial, voces compartidas) en server.ts.
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
