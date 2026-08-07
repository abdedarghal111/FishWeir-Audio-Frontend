<script lang="ts">
  // Lista compacta (foto + nombre + filtro) para elegir voz en la pestaña "Generar";
  // el resto de datos/acciones viven en sus propias pestañas.
  import type { Voice } from './types'

  let {
    voices,
    sharedVoices,
    referenceId = $bindable(''),
    onSelect,
  }: {
    voices: Voice[]
    sharedVoices: Voice[]
    referenceId: string
    // Se llama tras elegir voz, además de fijar referenceId (p. ej. para cerrar un modal).
    onSelect?: () => void
  } = $props()

  let search = $state('')
  let allVoices = $derived([...voices, ...sharedVoices])
  let filteredVoices = $derived(
    allVoices.filter((v) => v.title.toLowerCase().includes(search.trim().toLowerCase())),
  )

  function pick(id: string) {
    referenceId = id
    onSelect?.()
  }
</script>

<h3 class="h6">Voz clonada</h3>
<input type="search" class="form-control mb-2" bind:value={search} placeholder="Filtrar voces..." />

<button type="button" class="btn text-start w-100 mb-2" class:btn-primary={referenceId === ''} class:btn-outline-secondary={referenceId !== ''} onclick={() => pick('')}>
  Voz por defecto del modelo
</button>

{#if filteredVoices.length === 0}
  <p class="text-body-secondary mb-0">Ninguna voz coincide con "{search}".</p>
{:else}
  <div class="row g-2">
    {#each filteredVoices as voice (voice.id)}
      <div class="col-6">
        <button
          type="button"
          class="btn text-start d-flex align-items-center gap-2 w-100"
          class:btn-primary={referenceId === voice.id}
          class:btn-outline-secondary={referenceId !== voice.id}
          onclick={() => pick(voice.id)}
        >
          {#if voice.coverImage}
            <img src={voice.coverImage} alt="" class="rounded object-fit-cover flex-shrink-0" style="width: 2.25rem; height: 2.25rem;" />
          {:else}
            <span class="rounded bg-secondary-subtle flex-shrink-0" style="width: 2.25rem; height: 2.25rem;"></span>
          {/if}
          <span class="text-truncate">{voice.title}</span>
        </button>
      </div>
    {/each}
  </div>
{/if}
