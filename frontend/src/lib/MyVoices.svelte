<script lang="ts">
  // Pestaña "Mis voces": clonar una voz nueva (arriba) y, debajo, la lista de
  // tus voces ya clonadas, con botón de "Seleccionar" para fijarla como voz
  // clonada a usar en la pestaña "Generar".
  import type { Favorite, Voice } from './types'
  import CloneVoiceForm from './CloneVoiceForm.svelte'
  import VoiceCard from './VoiceCard.svelte'

  let {
    voices,
    favorites,
    referenceId = $bindable(''),
    isFavorite,
    onToggleFavorite,
    onCreateVoice,
    onDeleteVoice,
  }: {
    voices: Voice[]
    favorites: Favorite[]
    referenceId: string
    isFavorite: (type: Favorite['type'], id: string) => boolean
    onToggleFavorite: (type: Favorite['type'], id: string, label: string) => void
    onCreateVoice: (title: string, files: File[]) => Promise<void>
    onDeleteVoice: (id: string) => Promise<void>
  } = $props()

  let voicesError = $state('')

  async function deleteVoice(id: string) {
    try {
      await onDeleteVoice(id)
    } catch (err) {
      voicesError = err instanceof Error ? err.message : 'Error eliminando la voz'
    }
  }
</script>

<CloneVoiceForm {onCreateVoice} />

<hr class="my-4" />

<section>
  <h3 class="h5">Tus voces clonadas</h3>
  {#if voices.length === 0}
    <p class="text-body-secondary">Todavía no tienes ninguna voz clonada.</p>
  {:else}
    <div class="d-flex flex-column gap-3">
      {#each voices as voice (voice.id)}
        <VoiceCard
          {voice}
          favorite={isFavorite('voice', voice.id)}
          onToggleFavorite={() => onToggleFavorite('voice', voice.id, voice.title)}
          onSelect={() => (referenceId = voice.id)}
          selected={referenceId === voice.id}
          onRemove={() => deleteVoice(voice.id)}
          removeLabel="Eliminar"
        />
      {/each}
    </div>
  {/if}
  {#if voicesError}<div class="alert alert-danger py-2 mt-3 mb-0">{voicesError}</div>{/if}
</section>
