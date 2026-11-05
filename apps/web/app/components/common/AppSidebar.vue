<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useApi } from '~/composables/useApi'

interface PhaseOption {
  label: string
  value: number
}
type Preferences = ApiData<Api['api']['preferences']['get']>
const PhaseEdit = defineAsyncComponent(() => import('../edit/PhaseEdit.vue'))

const { now, timeZone } = useSystemTime()
const { mode } = useSystemStatus()
const writePreferencesClient = useApi({
  key: 'preferences',
  read: api => api.api.preferences.get(),
  write: (api, value: Preferences) => api.api.preferences.put(value)
})
const writePreferencesClientState = useAsyncData(writePreferencesClient.key, writePreferencesClient.read, { deep: true })
const { data: preferences } = writePreferencesClientState
async function writePreferences(value: Parameters<typeof writePreferencesClient.write>[0]) {
  try {
    const result = await writePreferencesClient.write(value)
    await writePreferencesClientState.refresh()
    return result
  } catch {
    return undefined
  }
}
const phasesClient = useApi({
  key: 'phases',
  read: api => api.api.phase.get()
})
const phasesClientState = useAsyncData(phasesClient.key, phasesClient.read, { deep: true })
const { data: phases } = phasesClientState

const addAnchor = ref<HTMLElement | null>(null)
const createMenuOpen = ref(false)
watch(mode, (value) => {
  if (value !== 'edit') createMenuOpen.value = false
})

const phaseOptions = computed<PhaseOption[]>(() => (phases.value ?? []).map(phase => ({
  label: phase.name,
  value: phase.id
})))

const phaseSelectValue = computed({
  get: () => preferences.value?.defaultPhaseId == null
    ? ''
    : String(preferences.value.defaultPhaseId),

  set: (value: string) => {
    if (preferences.value)
      void writePreferences({ ...preferences.value, defaultPhaseId: value === '' ? null : Number(value) })
  }
})

const navigationItems = [
  {
    label: '课程表',
    to: '/schedule',
    icon: 'lucide:calendar-days'
  },
  {
    label: '编辑',
    to: '/edit',
    icon: 'lucide:pen-line'
  },
  {
    label: '设置',
    to: '/setting',
    icon: 'lucide:settings'
  },
  {
    label: '资源管理',
    to: '/resources',
    icon: 'lucide:folder-open'
  }
]
const formattedDate = computed(() => {
  if (now.value === null) {
    return '--/--/--'
  }

  return now.value.toLocaleDateString('zh-CN', {
    timeZone: timeZone.value,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
})

const formattedTime = computed(() => {
  if (now.value === null) {
    return '--:--'
  }

  return now.value.toLocaleTimeString('zh-CN', {
    timeZone: timeZone.value,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
})
</script>

<template>
  <div class="app-sidebar">
    <!-- Logo -->
    <div class="app-sidebar-logo">
      <NuxtLink to="/">
        <img
          class="app-sidebar-logo-image"
          src="/logo.svg"
          alt="YuTD 首页"
        >
      </NuxtLink>
    </div>

    <!-- Phase 选择 -->
    <div class="app-sidebar-phase">
      <select
        v-model="phaseSelectValue"
        class="app-sidebar-phase-select"
        aria-label="默认阶段"
        :disabled="!preferences || phaseOptions.length === 0"
      >
        <option
          value=""
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
      <template
        v-for="item in navigationItems"
        :key="item.to"
      >
        <button
          v-if="item.to === '/edit'"
          class="app-sidebar-edit-toggle"
          :class="{ 'app-sidebar-edit-toggle--active': mode === 'edit' }"
          type="button"
          :title="mode === 'edit' ? '退出编辑模式' : '开启编辑模式'"
          :aria-label="mode === 'edit' ? '退出编辑模式' : '开启编辑模式'"
          :aria-pressed="mode === 'edit'"
          @click="mode = mode === 'edit' ? 'normal' : 'edit'"
        >
          <Icon
            :name="item.icon"
            size="24"
          />
        </button>
        <NuxtLink
          v-else
          :to="item.to"
          :aria-label="item.label"
        >
          <Icon
            :name="item.icon"
            size="24"
          />
        </NuxtLink>
      </template>
    </div>
    <div class="app-sidebar-time">
      <p class="app-sidebar-date">
        {{ formattedDate }}
      </p>
      <p class="app-sidebar-clock">
        {{ formattedTime }}
      </p>
    </div>
    <button
      v-if="mode === 'edit'"
      ref="addAnchor"
      class="app-sidebar-add"
      type="button"
      title="新建阶段、课程或任务"
      aria-label="新建阶段、课程或任务"
      :aria-expanded="createMenuOpen"
      @click="createMenuOpen = !createMenuOpen"
    >
      <Icon
        name="lucide:plus"
        size="22"
        aria-hidden="true"
      />
    </button>
    <PhaseEdit
      v-if="mode === 'edit'"
      v-model:open="createMenuOpen"
      :anchor="addAnchor"
      :phase-id="preferences?.defaultPhaseId"
    />
    <ClientOnly>
      <AppErrors />
    </ClientOnly>
  </div>
</template>

<style scoped>
.app-sidebar {
  position: fixed;
  z-index: 50;
  top: 0;
  left: 0;
  bottom: 0;
  box-sizing: border-box;

  display: flex;
  width: var(--app-sidebar-width);
  flex-direction: column;
  align-items: center;
  gap: 16px;

  padding: 12px 8px;

  background-color: var(--background-secondary);
  border-right: 1px solid var(--background-primary);
}
.app-sidebar-navigation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;

  width: 100%;
}
.app-sidebar-navigation a,
.app-sidebar-edit-toggle {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 44px;
  height: 44px;
  flex-shrink: 0;

  border-radius: 12px;
  color: var(--text-secondary);
  text-decoration: none;

  transition:
    color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.app-sidebar-navigation a:hover,
.app-sidebar-edit-toggle:hover {
  color: var(--text-primary);
  background-color: var(--background-primary);
}

.app-sidebar-navigation a.router-link-active,
.app-sidebar-edit-toggle--active {
  color: var(--text-primary);
  background-color: var(--background-primary);
}

.app-sidebar-navigation a:focus-visible,
.app-sidebar-edit-toggle:focus-visible {
  outline: 2px solid var(--text-secondary);
  outline-offset: 2px;
}
.app-sidebar-edit-toggle { padding: 0; border: 0; cursor: pointer; background: transparent; }
.app-sidebar-edit-toggle--active { color: var(--accent-color, var(--text-primary)); background: var(--background-primary); animation: sidebar-edit-glow 1.6s ease-in-out infinite; }
.app-sidebar-add { display: grid; place-items: center; flex-shrink: 0; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 12px; background: var(--background-primary); color: var(--accent-color, var(--text-primary)); cursor: pointer; }
.app-sidebar-add:hover { background: color-mix(in srgb, currentColor 12%, var(--background-primary)); }
.app-sidebar-add:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
@keyframes sidebar-edit-glow {
  0%, 100% { box-shadow: 0 0 2px color-mix(in srgb, currentColor 15%, transparent); }
  50% { box-shadow: 0 0 16px color-mix(in srgb, currentColor 65%, transparent), inset 0 0 8px color-mix(in srgb, currentColor 18%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .app-sidebar-edit-toggle--active { animation: none; box-shadow: 0 0 10px color-mix(in srgb, currentColor 45%, transparent); }
}
.app-sidebar-logo {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 48px;
  height: 48px;
  flex-shrink: 0;

  border-radius: 14px;
  transition: background-color 160ms ease;
}

.app-sidebar-logo a {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 100%;
  height: 100%;
}

.app-sidebar-logo-image {
  display: block;
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.app-sidebar-logo:hover {
  background-color: var(--background-primary);
}
.app-sidebar-phase {
  display: flex;
  justify-content: center;

  width: 100%;
  flex-shrink: 0;
}

.app-sidebar-phase-select {
  width: 100%;
  height: 36px;
  box-sizing: border-box;
  padding: 0 4px;

  border: 1px solid var(--background-primary);
  border-radius: 10px;

  background-color: var(--background-secondary);
  color: var(--text-primary);

  font: inherit;
  font-size: 12px;
  text-align: center;

  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.app-sidebar-phase-select:hover {
  border-color: var(--text-secondary);
}

.app-sidebar-phase-select:focus-visible {
  outline: 2px solid var(--text-secondary);
  outline-offset: 2px;
}

.app-sidebar-phase-select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.app-sidebar-time {
  margin-top: auto;
  flex-shrink: 0;
  width: 100%;
  text-align: center;
}

.app-sidebar-date,
.app-sidebar-clock {
  margin: 0;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}

.app-sidebar-date {
  color: var(--text-secondary);
  font-size: 10px;
}

.app-sidebar-clock {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

@media (width < 480px) {
  .app-sidebar {
    top: auto;
    right: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) 36px clamp(64px, 22vw, 106px) repeat(2, minmax(0, 1fr));
    grid-template-rows: 44px;
    align-content: start;
    gap: 4px;
    width: 100%;
    height: var(--app-bottom-bar-height);
    padding: 6px max(8px, env(safe-area-inset-right, 0px)) calc(26px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px));
    border-right: 0;
    border-top: 1px solid var(--background-primary);
  }

  .app-sidebar-navigation {
    display: contents;
  }

  .app-sidebar-navigation a,
  .app-sidebar-edit-toggle {
    grid-row: 1;
    justify-self: center;
    width: 100%;
    max-width: 44px;
    min-width: 0;
  }

  .app-sidebar-navigation > :nth-child(1) { grid-column: 1; }
  .app-sidebar-navigation > :nth-child(2) { grid-column: 2; }
  .app-sidebar-navigation > :nth-child(3) { grid-column: 5; }
  .app-sidebar-navigation > :nth-child(4) { grid-column: 6; }

  .app-sidebar-logo {
    grid-area: 1 / 3;
    width: 36px;
    height: 44px;
  }

  .app-sidebar-logo-image {
    width: 30px;
    height: 30px;
  }

  .app-sidebar-phase {
    grid-area: 1 / 4;
    min-width: 0;
  }

  .app-sidebar-phase-select {
    min-width: 0;
    text-overflow: ellipsis;
  }

  .app-sidebar-time {
    position: absolute;
    right: max(8px, env(safe-area-inset-right, 0px));
    bottom: calc(4px + env(safe-area-inset-bottom, 0px));
    display: flex;
    align-items: baseline;
    gap: 6px;
    width: auto;
    margin: 0;
    white-space: nowrap;
  }

  .app-sidebar-add {
    position: absolute;
    left: max(8px, env(safe-area-inset-left, 0px));
    bottom: calc(4px + env(safe-area-inset-bottom, 0px));
    width: 22px;
    height: 22px;
    border-radius: 7px;
  }

  .app-sidebar :deep(.app-errors) {
    position: absolute;
    left: 8px;
    bottom: calc(100% + 8px);
    width: 44px;
  }

  .app-sidebar :deep(.app-errors__panel) {
    left: 0;
    bottom: calc(100% + 8px);
    width: min(360px, calc(100vw - 16px));
  }
}
</style>
