<script setup lang="ts">
const { errors, dismissError, clearErrors } = useAppErrors()
const expanded = ref(true)
const count = computed(() => errors.value.reduce((total, error) => total + error.count, 0))

watch(() => [errors.value.at(-1)?.id ?? 0, count.value] as const, ([id, value], [previousId, previous]) => {
  if (id > previousId || value > previous)
    expanded.value = true
})
</script>

<template>
  <div
    v-if="errors.length"
    class="app-errors"
  >
    <button
      class="app-errors__toggle"
      type="button"
      :aria-expanded="expanded"
      aria-controls="app-error-list"
      :aria-label="`${expanded ? '收起' : '展开'}错误详情，共 ${count} 次错误`"
      @click="expanded = !expanded"
    >
      <Icon
        name="lucide:triangle-alert"
        size="20"
      />
      <span>{{ count }}</span>
    </button>
    <section
      v-show="expanded"
      id="app-error-list"
      class="app-errors__panel"
      aria-label="错误信息"
    >
      <header class="app-errors__header">
        <strong>错误信息</strong>
        <button
          type="button"
          @click="clearErrors"
        >
          全部清除
        </button>
        <button
          type="button"
          aria-label="收起错误详情"
          @click="expanded = false"
        >
          收起
        </button>
      </header>
      <ul
        class="app-errors__list"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <li
          v-for="error in errors"
          :key="error.id"
          class="app-errors__item"
        >
          <div>
            <strong>{{ error.source }}<span v-if="error.count > 1"> ×{{ error.count }}</span></strong>
            <p v-if="error.message !== error.source">
              {{ error.message }}
            </p>
          </div>
          <button
            type="button"
            :aria-label="`关闭错误：${error.source}`"
            @click="dismissError(error.id)"
          >
            <Icon
              name="lucide:x"
              size="16"
            />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.app-errors {
  position: relative;
  width: 100%;
  flex-shrink: 0;
  color: #b42336;
}

.app-errors__toggle {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 1px solid rgb(180 35 54 / 22%);
  border-radius: 12px;
  background: rgb(255 224 230 / 65%);
  color: inherit;
  cursor: pointer;
  font-size: 11px;
}

.app-errors__panel {
  position: absolute;
  bottom: 0;
  left: calc(100% + 16px);
  width: min(360px, calc(100vw - var(--app-sidebar-width) - 24px));
  overflow: hidden;
  border: 1px solid rgb(180 35 54 / 22%);
  border-radius: 14px;
  background: color-mix(in srgb, var(--background-secondary) 92%, transparent);
  box-shadow: 0 12px 36px rgb(23 32 51 / 15%), inset 0 1px rgb(255 255 255 / 75%);
  backdrop-filter: blur(22px) saturate(140%);
}

.app-errors__header,
.app-errors__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
}

.app-errors__header {
  align-items: center;
  border-bottom: 1px solid rgb(180 35 54 / 12%);
}

.app-errors__header strong {
  flex: 1;
}

.app-errors button:not(.app-errors__toggle) {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 3px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 12px;
}

.app-errors button:hover {
  background-color: rgb(180 35 54 / 8%);
}

.app-errors__list {
  max-height: min(50dvh, 380px);
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  overscroll-behavior: contain;
}

.app-errors__item + .app-errors__item {
  border-top: 1px solid rgb(180 35 54 / 10%);
}

.app-errors__item > div {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.app-errors__item p {
  margin: 5px 0 0;
  color: var(--text-primary);
  white-space: pre-wrap;
}
</style>
