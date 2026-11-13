<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useApi } from '~/composables/useApi'

interface PhaseOption {
  label: string
  value: number
}
const PhaseEdit = defineAsyncComponent(() => import('../edit/PhaseEdit.vue'))

const { now, timeZone } = useSystemTime()
const { mode } = useSystemStatus()
const { preferences, loading } = useAppPeferences()
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
  get: () => preferences.value?.defaultPhaseId == null ? '' : String(preferences.value.defaultPhaseId),

  set: (value: string) => {
    if (preferences.value) preferences.value.defaultPhaseId = value === '' ? null : Number(value)
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
  <div
    class="app-sidebar"
    :class="{ 'app-sidebar--editing': mode === 'edit' }"
  >
    <!-- Logo -->
    <div class="app-sidebar-logo">
      <NuxtLink
        to="/"
        class="app-sidebar-control"
        aria-label="首页"
      >
        <img
          class="app-sidebar-logo-image"
          src="/logo.svg"
          alt="YuTD 首页"
        >
        <Icon
          class="app-sidebar-icon app-sidebar-home-icon"
          name="lucide:house"
          aria-hidden="true"
        />
      </NuxtLink>
    </div>

    <!-- Phase 选择 -->
    <div class="app-sidebar-phase">
      <select
        v-model="phaseSelectValue"
        class="app-sidebar-phase-select"
        aria-label="默认阶段"
        :disabled="loading || !preferences || phaseOptions.length === 0"
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
        <span
          v-if="item.to === '/edit'"
          class="app-sidebar-divider"
          aria-hidden="true"
        />
        <button
          v-if="item.to === '/edit'"
          class="app-sidebar-control app-sidebar-edit-toggle"
          :class="{ 'app-sidebar-edit-toggle--active': mode === 'edit' }"
          type="button"
          :title="mode === 'edit' ? '退出编辑模式' : '开启编辑模式'"
          :aria-label="mode === 'edit' ? '退出编辑模式' : '开启编辑模式'"
          :aria-pressed="mode === 'edit'"
          @click="mode = mode === 'edit' ? 'normal' : 'edit'"
        >
          <Icon
            class="app-sidebar-icon"
            :name="item.icon"
          />
        </button>
        <NuxtLink
          v-else
          class="app-sidebar-control"
          :to="item.to"
          :aria-label="item.label"
        >
          <Icon
            class="app-sidebar-icon"
            :name="item.icon"
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
      class="app-sidebar-control app-sidebar-add"
      type="button"
      title="新建阶段、课程或任务"
      aria-label="新建阶段、课程或任务"
      :aria-expanded="createMenuOpen"
      @click="createMenuOpen = !createMenuOpen"
    >
      <Icon
        class="app-sidebar-icon"
        name="lucide:plus"
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
  --sidebar-item-size: var(--app-sidebar-width) ;
  --sidebar-icon-size: calc(var(--sidebar-item-size) - 45px);
  --sidebar-control-width: var(--app-sidebar-width);
  --sidebar-control-height: var(--sidebar-item-size);

  position: fixed;
  z-index: 50;
  top: 0;
  left: 0;
  bottom: 0;
  box-sizing: border-box;

  display: flex;
  width: calc(var(--app-sidebar-width) + var(--app-safe-left));
  flex-direction: column;
  align-items: center;
  gap: 0;

  padding: var(--app-safe-top) 0 var(--app-safe-bottom) var(--app-safe-left);

  background-color: var(--background-secondary);
  border-right: 1px solid var(--background-primary);
}
.app-sidebar-navigation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;

  width: 100%;
}
.app-sidebar-navigation a,
.app-sidebar-edit-toggle {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 100%;
  height: var(--sidebar-item-size);
  flex-shrink: 0;

  border-radius: 12px;
  color: var(--text-secondary);
  text-decoration: none;

  transition: color 160ms ease;
}

.app-sidebar-navigation a:hover,
.app-sidebar-edit-toggle:hover {
  color: var(--text-primary);
}

.app-sidebar-navigation a:focus-visible,
.app-sidebar-edit-toggle:focus-visible {
  outline: 2px solid var(--text-secondary);
  outline-offset: 2px;
}
.app-sidebar-edit-toggle { padding: 0; border: 0; cursor: pointer; background: transparent; }
.app-sidebar-divider { display: none; }
.app-sidebar-icon {
  width: min(var(--sidebar-icon-size), calc(var(--sidebar-control-width) * 0.7 - 4px), calc(var(--sidebar-control-height) * 0.4 - 4px));
  height: min(var(--sidebar-icon-size), calc(var(--sidebar-control-width) * 0.7 - 4px), calc(var(--sidebar-control-height) * 0.4 - 4px));
  flex-shrink: 0;
  pointer-events: none;
}
.app-sidebar-home-icon { display: none; }
.app-sidebar-add { display: grid; place-items: center; flex-shrink: 0; width: 100%; height: var(--sidebar-item-size); padding: 0; border: 0; border-radius: 12px; background: transparent; color: var(--text-secondary); cursor: pointer; transition: color 160ms ease; }
.app-sidebar-add:hover { color: var(--text-primary); }
.app-sidebar-add:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.app-sidebar-logo {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 100%;
  height: var(--sidebar-item-size);
  flex-shrink: 0;

  border-radius: 14px;
}

.app-sidebar-logo a {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 100%;
  height: 100%;
  color: var(--text-secondary);
  transition: color 160ms ease;
}

.app-sidebar-logo-image {
  display: block;
  width: calc(var(--sidebar-icon-size) + 6px);
  height: calc(var(--sidebar-icon-size) + 6px);
  object-fit: contain;
}

.app-sidebar-control {
  position: relative;
  isolation: isolate;
}

.app-sidebar-control::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 30%;
  left: 15%;
  width: 70%;
  height: 40%;
  border-radius: 999px;
  background-color: var(--text-primary);
  opacity: 0;
  transform: scaleX(0);
  pointer-events: none;
}

.app-sidebar-control:is(.router-link-active, .app-sidebar-edit-toggle--active, [aria-expanded='true']) {
  color: var(--background-secondary);
}

.app-sidebar-control:is(.router-link-active, .app-sidebar-edit-toggle--active, [aria-expanded='true'])::before {
  opacity: 1;
  transform: scaleX(1);
  animation: sidebar-activate 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.app-sidebar-control:is(.router-link-active, .app-sidebar-edit-toggle--active, [aria-expanded='true']) .app-sidebar-icon {
  color: var(--background-secondary);
}

@keyframes sidebar-activate {
  from { opacity: 0; transform: scaleX(0.25); }
  to { opacity: 1; transform: scaleX(1); }
}

@media (prefers-reduced-motion: reduce) {
  .app-sidebar-control:is(.router-link-active, .app-sidebar-edit-toggle--active, [aria-expanded='true'])::before {
    animation: none;
  }
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
    --sidebar-cell-width: calc((100vw - var(--app-safe-left) - var(--app-safe-right) - 1px) / 4);
    --sidebar-item-size: min(calc(var(--app-bottom-bar-height) - var(--app-safe-bottom)), var(--sidebar-cell-width));
    --sidebar-icon-size: calc(var(--sidebar-item-size) - 36px);
    --sidebar-control-width: var(--sidebar-cell-width);
    --sidebar-control-height: calc(var(--app-bottom-bar-height) - var(--app-safe-bottom) - 1px);

    top: auto;
    right: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) 1px minmax(0, 0.7fr) minmax(0, 0.3fr);
    grid-template-rows: minmax(0, 1fr);
    width: 100%;
    height: var(--app-bottom-bar-height);
    padding: 0 var(--app-safe-right) var(--app-safe-bottom) var(--app-safe-left);
    border-right: 0;
    border-top: 1px solid var(--background-primary);
  }

  .app-sidebar-navigation {
    display: contents;
  }

  .app-sidebar-home-icon {
    display: inline-block;
  }

  .app-sidebar-logo-image {
    display: none;
  }

  .app-sidebar-navigation a,
  .app-sidebar-edit-toggle,
  .app-sidebar-logo,
  .app-sidebar-add {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .app-sidebar-divider {
    display: block;
    order: 1;
    width: 1px;
    height: 50%;
    align-self: center;
    flex-shrink: 0;
    background-color: var(--text-primary);
  }

  .app-sidebar-edit-toggle {
    order: 2;
    grid-column: 5 / 7;
    grid-row: 1;
  }

  .app-sidebar--editing .app-sidebar-edit-toggle,
  .app-sidebar-add {
    --sidebar-icon-size: min(calc(var(--sidebar-item-size) - 36px), calc(var(--sidebar-control-width) - 12px));
  }

  .app-sidebar--editing .app-sidebar-edit-toggle {
    --sidebar-control-width: calc(var(--sidebar-cell-width) * 0.7);
    grid-column: 5;
  }

  .app-sidebar-add {
    --sidebar-control-width: calc(var(--sidebar-cell-width) * 0.3);
    order: 3;
    grid-column: 6;
    grid-row: 1;
  }

  .app-sidebar-phase,
  .app-sidebar-time,
  .app-sidebar-navigation a[href="/resources"] {
    display: none;
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
