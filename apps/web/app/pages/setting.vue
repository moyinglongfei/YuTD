<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'
import { useWrite } from '~/composables/useWrite'

const { $api } = useNuxtApp()

const { data: style, loading, readError, refresh } = useRead(
  'style',
  () => requestApiData($api.api.style.get(), '获取设置失败')
)

const form = reactive({
  defaultLocale: 'zh-CN',
  scheduleBackground: '#f4efe7',
  schedulePanelBackground: 'rgba(255, 255, 255, 0.82)',
  scheduleGridLineColor: 'rgba(226, 232, 240, 0.9)',
  scheduleSlotHeight: 72,
  scheduleSlotGap: 8,
  presetName: 'campus',
  coursePalette: '#0f766e\n#1d4ed8\n#be123c\n#7c3aed',
  schedulePageClass: '',
  scheduleBoardClass: '',
  scheduleCardClass: '',
  customCss: ''
})

watch(style, (value) => {
  if (!value)
    return

  form.defaultLocale = value.defaultLocale
  form.scheduleBackground = value.scheduleBackground
  form.schedulePanelBackground = value.schedulePanelBackground
  form.scheduleGridLineColor = value.scheduleGridLineColor
  form.scheduleSlotHeight = value.scheduleSlotHeight
  form.scheduleSlotGap = value.scheduleSlotGap
  form.presetName = value.presetName
  form.coursePalette = value.coursePalette.join('\n')
  form.schedulePageClass = value.schedulePageClass
  form.scheduleBoardClass = value.scheduleBoardClass
  form.scheduleCardClass = value.scheduleCardClass
  form.customCss = value.customCss
}, { immediate: true })

const coursePalette = computed(() =>
  form.coursePalette
    .split(/\r?\n/)
    .map(color => color.trim())
    .filter(Boolean)
)

const { submitting, submitError, execute } = useWrite(async () => {
  const defaultLocale = form.defaultLocale.trim()
  const presetName = form.presetName.trim()

  if (!defaultLocale)
    throw new Error('请输入默认语言')

  if (!presetName)
    throw new Error('请输入预设名称')

  if (!Number.isInteger(form.scheduleSlotHeight) || form.scheduleSlotHeight < 24 || form.scheduleSlotHeight > 240)
    throw new Error('课程表时间槽高度必须在 24 到 240 之间')

  if (!Number.isInteger(form.scheduleSlotGap) || form.scheduleSlotGap < 0 || form.scheduleSlotGap > 48)
    throw new Error('课程表时间槽间距必须在 0 到 48 之间')

  if (coursePalette.value.length === 0)
    throw new Error('请至少输入一个课程颜色')

  return requestApiData(
    $api.api.style.post({
      defaultLocale,
      scheduleBackground: form.scheduleBackground.trim(),
      schedulePanelBackground: form.schedulePanelBackground.trim(),
      scheduleGridLineColor: form.scheduleGridLineColor.trim(),
      scheduleSlotHeight: form.scheduleSlotHeight,
      scheduleSlotGap: form.scheduleSlotGap,
      presetName,
      coursePalette: coursePalette.value,
      schedulePageClass: form.schedulePageClass.trim(),
      scheduleBoardClass: form.scheduleBoardClass.trim(),
      scheduleCardClass: form.scheduleCardClass.trim(),
      customCss: form.customCss
    }),
    '保存设置失败'
  )
})

async function submit() {
  const success = await execute()

  if (success)
    await refreshNuxtData('style')
}
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

      <div
        v-else
        class="setting-page__workspace"
      >
        <form
          class="setting-form"
          @submit.prevent="submit"
        >
          <fieldset
            :disabled="submitting"
            class="setting-form__fieldset"
          >
            <section class="setting-form__section">
              <h2>基础</h2>
              <div class="setting-form__grid">
                <label class="setting-form__field">
                  <span>默认语言</span>
                  <input
                    v-model="form.defaultLocale"
                    type="text"
                    required
                  >
                </label>
                <label class="setting-form__field">
                  <span>预设名称</span>
                  <input
                    v-model="form.presetName"
                    type="text"
                    required
                  >
                </label>
              </div>
            </section>

            <section class="setting-form__section">
              <h2>课程表视觉</h2>
              <div class="setting-form__grid">
                <label class="setting-form__field">
                  <span>页面背景</span>
                  <input
                    v-model="form.scheduleBackground"
                    type="text"
                    required
                  >
                </label>
                <label class="setting-form__field">
                  <span>面板背景</span>
                  <input
                    v-model="form.schedulePanelBackground"
                    type="text"
                    required
                  >
                </label>
                <label class="setting-form__field">
                  <span>网格线颜色</span>
                  <input
                    v-model="form.scheduleGridLineColor"
                    type="text"
                    required
                  >
                </label>
                <label class="setting-form__field">
                  <span>时间槽高度</span>
                  <input
                    v-model.number="form.scheduleSlotHeight"
                    type="number"
                    min="24"
                    max="240"
                    step="1"
                    required
                  >
                </label>
                <label class="setting-form__field">
                  <span>时间槽间距</span>
                  <input
                    v-model.number="form.scheduleSlotGap"
                    type="number"
                    min="0"
                    max="48"
                    step="1"
                    required
                  >
                </label>
              </div>
            </section>

            <section class="setting-form__section">
              <h2>课程颜色</h2>
              <label class="setting-form__field">
                <span>每行一个 CSS 颜色</span>
                <textarea
                  v-model="form.coursePalette"
                  rows="5"
                  required
                />
              </label>
            </section>

            <section class="setting-form__section">
              <h2>扩展样式</h2>
              <div class="setting-form__grid">
                <label class="setting-form__field">
                  <span>页面 class</span>
                  <input
                    v-model="form.schedulePageClass"
                    type="text"
                  >
                </label>
                <label class="setting-form__field">
                  <span>课程表面板 class</span>
                  <input
                    v-model="form.scheduleBoardClass"
                    type="text"
                  >
                </label>
                <label class="setting-form__field">
                  <span>课程卡片 class</span>
                  <input
                    v-model="form.scheduleCardClass"
                    type="text"
                  >
                </label>
              </div>
              <label class="setting-form__field">
                <span>自定义 CSS</span>
                <textarea
                  v-model="form.customCss"
                  rows="6"
                />
              </label>
            </section>
          </fieldset>

          <p
            v-if="submitError"
            class="setting-form__error"
          >
            {{ submitError }}
          </p>

          <footer class="setting-form__footer">
            <button
              type="submit"
              :disabled="submitting"
            >
              {{ submitting ? '保存中……' : '保存设置' }}
            </button>
          </footer>
        </form>

        <aside class="setting-preview">
          <h2>预览</h2>
          <div
            class="setting-preview__board"
            :style="{
              'backgroundColor': form.scheduleBackground,
              '--preview-panel': form.schedulePanelBackground,
              '--preview-line': form.scheduleGridLineColor,
              '--preview-slot-height': `${form.scheduleSlotHeight}px`,
              '--preview-slot-gap': `${form.scheduleSlotGap}px`
            }"
          >
            <div class="setting-preview__panel">
              <span
                v-for="(color, index) in coursePalette"
                :key="`${color}-${index}`"
                class="setting-preview__course"
                :style="{ backgroundColor: color }"
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  </main>
</template>
