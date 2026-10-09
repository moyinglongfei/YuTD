<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

const { $api } = useNuxtApp()

const { data: style, loading, readError, refresh } = useRead(
  'style',
  () => requestApiData($api.api.style.get(), '获取设置失败')
)

const form = reactive({
  defaultLocale: 'zh-CN'
})

watch(style, (value) => {
  if (!value)
    return

  form.defaultLocale = value.defaultLocale
}, { immediate: true })

const fontId = ref('system')

function handleFontChange() {
  applyAppFont(fontId.value)
}

onMounted(() => {
  const stored = localStorage.getItem('yutd-font-family')
  fontId.value = appFontOptions.find(option => option.id === stored)?.id ?? 'system'
})
</script>

<template>
  <main class="setting-page">
    <section class="setting-page__container">
      <header class="setting-page__header">
        <p class="setting-page__eyebrow">
          应用设置
        </p>
        <h1 class="setting-page__title">
          视觉与课程表参数
        </h1>
      </header>

      <div
        v-if="readError"
        class="setting-page__state setting-page__state--error"
      >
        <p>{{ readError }}</p>
        <button
          type="button"
          :disabled="loading"
          @click="refresh()"
        >
          {{ loading ? '重试中……' : '重试' }}
        </button>
      </div>
      <p
        v-else-if="loading"
        class="setting-page__state"
        role="status"
      >
        正在加载设置……
      </p>
      <label class="setting-form__field">
        <span>界面字体（本地保存，即时生效）</span>
        <select
          v-model="fontId"
          @change="handleFontChange"
        >
          <option
            v-for="option in appFontOptions"
            :key="option.id"
            :value="option.id"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
      <label class="setting-form__field">
        <span>默认语言</span>
        <input
          v-model="form.defaultLocale"
          type="text"
          required
        >
      </label>
    </section>
  </main>
</template>
