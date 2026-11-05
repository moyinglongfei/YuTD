<script setup lang="ts">
const props = withDefaults(defineProps<{
  width?: string | number
  height?: string | number
}>(), {
  width: '100%',
  height: 'auto'
})

function normalizeSize(value: string | number) {
  return typeof value === 'number' ? `${value}px` : value
}

const cardStyle = computed(() => ({
  width: normalizeSize(props.width),
  height: normalizeSize(props.height)
}))
</script>

<template>
  <section
    class="page-card"
    :style="cardStyle"
    tabindex="0"
  >
    <slot />
  </section>
</template>

<style scoped>
.page-card {
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  flex-shrink: 0;
  padding: 4px;
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--text-secondary) 32%, transparent);
  border-radius: 14px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--background-secondary) 90%, transparent), color-mix(in srgb, var(--background-primary) 75%, transparent)),
    color-mix(in srgb, var(--background-secondary) 80%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--background-secondary) 95%, transparent),
    inset 0 -1px 0 color-mix(in srgb, var(--background-secondary) 55%, transparent),
    0 3px 12px color-mix(in srgb, var(--text-primary) 7%, transparent);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  backdrop-filter: blur(24px) saturate(150%);
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--text-secondary) 48%, transparent) transparent;
}
</style>
