<script lang="ts">
  // Tarjeta de una voz, usada tanto en la biblioteca como en el selector del panel de texto.
  import { STATE_BADGES, STATE_LABELS, VISIBILITY_LABELS, formatDate, type Voice } from './types'

  let {
    voice,
    favorite,
    onToggleFavorite,
    onRemove = undefined,
    removeLabel = 'Eliminar',
    onEdit = undefined,
    onSelect = undefined,
    selected = false,
    compact = false,
  }: {
    voice: Voice
    favorite: boolean
    onToggleFavorite: () => void
    onRemove?: (() => void) | undefined
    removeLabel?: string
    // Sólo se pasa para las voces propias: las compartidas son de otra cuenta.
    onEdit?: (() => void) | undefined
    onSelect?: (() => void) | undefined
    selected?: boolean
    compact?: boolean
  } = $props()
</script>

<div class="card" class:border-primary={selected}>
  <div class="card-body d-flex gap-3">
    {#if voice.coverImage}
      <img
        src={voice.coverImage}
        alt=""
        class="rounded object-fit-cover flex-shrink-0"
        style="width: 4.5rem; height: 4.5rem;"
      />
    {/if}
    <div class="flex-grow-1" style="min-width: 0;">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h4 class="h6 mb-1 text-truncate">{voice.title}</h4>
        <div class="d-flex gap-2 flex-shrink-0">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            title={favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            onclick={onToggleFavorite}
          >
            <i class="fa-{favorite ? 'solid' : 'regular'} fa-star" aria-hidden="true"></i>
          </button>
          {#if onEdit}
            <button type="button" class="btn btn-sm btn-outline-secondary" title="Editar voz" onclick={onEdit}>
              <i class="fa-solid fa-pen" aria-hidden="true"></i>
            </button>
          {/if}
          {#if onSelect}
            <button type="button" class="btn btn-sm" class:btn-primary={selected} class:btn-outline-primary={!selected} onclick={onSelect}>
              {selected ? 'Seleccionada' : 'Seleccionar'}
            </button>
          {/if}
          {#if onRemove}
            <button type="button" class="btn btn-sm btn-outline-danger" onclick={onRemove}>
              {removeLabel}
            </button>
          {/if}
        </div>
      </div>

      {#if !compact}
        <div class="d-flex flex-wrap gap-1 mb-1 meta">
          {#if voice.state}
            <span class="badge {STATE_BADGES[voice.state] ?? 'text-bg-secondary'}">{STATE_LABELS[voice.state] ?? voice.state}</span>
          {/if}
          {#if voice.visibility}
            <span class="badge text-bg-light border">{VISIBILITY_LABELS[voice.visibility] ?? voice.visibility}</span>
          {/if}
          {#if voice.trainMode}
            <span class="badge text-bg-light border">Entrenamiento: {voice.trainMode}</span>
          {/if}
          {#each voice.languages ?? [] as lang (lang)}
            <span class="badge text-bg-light border">{lang}</span>
          {/each}
          {#each voice.tags ?? [] as tag (tag)}
            <span class="badge text-bg-light border">#{tag}</span>
          {/each}
        </div>
      {/if}

      {#if voice.description}
        <p class="mb-1 meta text-body-secondary">{voice.description}</p>
      {/if}

      {#if !compact}
        <div class="d-flex flex-wrap gap-2 meta text-body-secondary mb-1">
          <span><i class="fa-solid fa-heart" aria-hidden="true"></i> {voice.likeCount ?? 0} me gusta</span>
          <span><i class="fa-solid fa-bookmark" aria-hidden="true"></i> {voice.markCount ?? 0} guardados</span>
          <span><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> {voice.sharedCount ?? 0} compartidos</span>
          <span title="Contador de Fish Audio; no está documentado si suma las generaciones hechas desde la API.">
            <i class="fa-solid fa-play" aria-hidden="true"></i> {voice.taskCount ?? 0} generaciones
          </span>
        </div>

        <div class="d-flex flex-wrap gap-2 meta text-body-secondary mb-1">
          <span>Creada: {formatDate(voice.createdAt)}</span>
          {#if voice.updatedAt && voice.updatedAt !== voice.createdAt}
            <span>Actualizada: {formatDate(voice.updatedAt)}</span>
          {/if}
        </div>
      {/if}

      {#if voice.author?.nickname}
        <div class="d-flex align-items-center gap-2 meta text-body-secondary mb-1">
          {#if voice.author.avatar}
            <img src={voice.author.avatar} alt="" class="rounded-circle" width="16" height="16" />
          {/if}
          <span>Autor: {voice.author.nickname}</span>
        </div>
      {/if}

      {#each voice.samples ?? [] as sample (sample.task_id)}
        <audio controls src={sample.audio} class="w-100"></audio>
      {/each}

      {#if !compact}
        <a
          class="meta text-body-secondary text-decoration-none d-inline-block mt-1"
          href="https://fish.audio/m/{voice.id}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i> Ver en fish.audio
        </a>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Metadatos secundarios frente al título/acciones: más pequeños, menos espacio. */
  .meta {
    font-size: 0.75rem;
  }
</style>
