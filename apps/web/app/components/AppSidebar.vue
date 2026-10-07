<script setup lang="ts">
import { requestApiData } from '~/utils/api'
import { useRead } from '~/composables/useRead'

interface PhaseOption {
  label: string
  value: number
}

const { $api } = useNuxtApp()
const route = useRoute()
const logoSrc = '/logo.svg'

const selectedPhaseId = useState<number | null>('selectedPhaseId', () => null)
const { data: phases, readError, refresh } = useRead('phases', async () => {
  if (import.meta.server)
    return []

  return requestApiData($api.api.phase.get(), '获取 Phase 列表失败')
})
const phaseOptions = computed<PhaseOption[]>(() =>
  phases.value?.map(phase => ({
    label: phase.name,
    value: phase.id
  })) ?? []
)
const phaseLoadError = computed(() => readError.value)

const phaseSelectValue = computed({
  get() {
    return selectedPhaseId.value === null ? '' : String(selectedPhaseId.value)
  },
  set(value: string) {
    selectedPhaseId.value = value === '' ? null : Number(value)
  }
})

const navigationItems = [
  {
    label: '课程表',
    to: '/schedule',
    iconPaths: [
      'M8 2v4',
      'M16 2v4',
      'M3 10h18',
      'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'
    ]
  },
  {
    label: '编辑',
    to: '/edit',
    iconPaths: [
      'M12 20h9',
      'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'
    ]
  },
  {
    label: '设置',
    to: '/setting',
    iconPaths: [
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z',
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'
    ]
  }
]

function isNavigationActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

watch(phaseOptions, (options) => {
  if (options.length === 0)
    return

  if (selectedPhaseId.value === null || !options.some(option => option.value === selectedPhaseId.value)) {
    selectedPhaseId.value = options[0]?.value ?? null
  }
}, { immediate: true })

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="app-sidebar">
    <!-- Logo -->
    <div class="app-sidebar-logo">
      <NuxtLink to="/">
        <img
          class="app-sidebar-logo-image"
          :src="logoSrc"
          alt="YuTD 首页"
        >
      </NuxtLink>
    </div>

    <!-- Phase 选择 -->
    <div class="app-sidebar-phase">
      <select
        v-model="phaseSelectValue"
        class="app-sidebar-phase-select"
        :disabled="phaseOptions.length === 0"
      >
        <option
          value=""
          disabled
        >
          Phase
        </option>

        <option
          v-for="phase in phaseOptions"
          :key="phase.value"
          :value="String(phase.value)"
        >
          {{ phase.label }}
        </option>
      </select>
    </div>

    <!-- 导航 -->
    <div class="app-sidebar-navigation">
      <NuxtLink
        v-for="item in navigationItems"
        :key="item.to"
        class="app-sidebar-navigation-button"
        :class="{
          'app-sidebar-navigation-button--active':
            isNavigationActive(item.to)
        }"
        :to="item.to"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            v-for="path in item.iconPaths"
            :key="path"
            :d="path"
          />
        </svg>

        <span>
          {{ item.label }}
        </span>
      </NuxtLink>
    </div>

    <!-- 错误信息 -->
    <div
      v-if="phaseLoadError"
      class="app-sidebar-error"
    >
      {{ phaseLoadError }}
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.app-sidebar {
  flex: 0 0 var(--app-sidebar-width);
  width: var(--app-sidebar-width);
  min-height: 100vh;
  box-sizing: border-box;

  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  padding: 12px 8px;

  background-color: var(--app-sidebar-background);
  border-right: 1px solid var(--app-sidebar-border);
}

.app-sidebar-logo {
  align-self: flex-start;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  margin-left: 2px;
  border-radius: 14px;
  transition: background-color 160ms ease;
}

.app-sidebar-logo:hover,
.app-sidebar-logo:focus-visible {
  background-color: var(--app-sidebar-primary-soft);
}

.app-sidebar-logo-image {
  display: block;
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.app-sidebar-phase {
  display: flex;
  width: 100%;
}

.app-sidebar-phase-select {
  width: 100%;
  max-width: 50px;
  height: 34px;
  box-sizing: border-box;
  padding: 0 4px;
  border: 1px solid var(--app-sidebar-border);
  border-radius: 10px;
  background-color: #f8fafc;
  color: var(--app-sidebar-text);
  font: inherit;
  font-size: 12px;
  text-align: center;
  appearance: none;
}

.app-sidebar-phase-select:focus {
  border-color: var(--app-sidebar-primary);
  outline: 2px solid var(--app-sidebar-primary-soft);
  outline-offset: 1px;
}

.app-sidebar-phase-select:disabled {
  color: var(--app-sidebar-muted);
  cursor: not-allowed;
}

.app-sidebar-navigation {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.app-sidebar-navigation-button {
  display: grid;
  justify-items: center;
  gap: 4px;
  box-sizing: border-box;
  width: 100%;
  padding: 9px 2px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--app-sidebar-text);
  font-size: 11px;
  line-height: 1.2;
  text-decoration: none;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.app-sidebar-navigation-button:hover,
.app-sidebar-navigation-button:focus-visible {
  border-color: var(--app-sidebar-border);
  background-color: #f8fafc;
  color: var(--app-sidebar-primary);
}

.app-sidebar-navigation-button--active,
.app-sidebar-navigation-button--active:hover,
.app-sidebar-navigation-button--active:focus-visible {
  border-color: #b3f5d1;
  background-color: var(--app-sidebar-primary-soft);
  color: var(--app-sidebar-primary);
}

.app-sidebar-navigation-button svg {
  width: 22px;
  height: 22px;
}

.app-sidebar-navigation-button path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.app-sidebar-error {
  max-width: 100%;
  margin: 0;
  color: #dc2626;
  font-size: 10px;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
}

.app-sidebar-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  :root {
    --app-sidebar-width: 68px;
  }

  .app-sidebar {
    gap: 12px;
    padding: 8px 6px;
  }

  .app-sidebar-logo {
    width: 42px;
    height: 42px;
    border-radius: 12px;
  }

  .app-sidebar-logo-image {
    width: 32px;
    height: 32px;
  }

  .app-sidebar-navigation-button {
    padding: 8px 1px;
    font-size: 10px;
  }
}
</style>
