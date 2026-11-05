// 该组件用于通用的非特殊参数调整
<script setup lang="ts">
import AppPopup from '../common/AppPopup.vue'
import { editFieldErrors, editFieldStep, editFieldType, editFieldValues } from '~/utils/editFields'
import type { EditField, EditValues } from '~/utils/editFields'

const props = withDefaults(defineProps<{
  fields: EditField[]
  values: EditValues
  save: (values: EditValues) => unknown | Promise<unknown>
  title?: string
  anchor?: HTMLElement | null
}>(), { title: 'QAQ', anchor: null })
const opened = defineModel<boolean>('open', { default: false })
const formId = useId()
const emit = defineEmits<{
  change: [values: EditValues]
  saved: [values: EditValues]
}>()
const draft = ref<EditValues>({})
const saving = ref(false)
const error = ref('')
const errors = computed(() => editFieldErrors(props.fields, draft.value))
const valid = computed(() => Object.keys(errors.value).length === 0)

watch(opened, (open) => {
  error.value = ''
  if (open) draft.value = editFieldValues(props.fields, props.values)
  else emit('change', editFieldValues(props.fields, props.values))
}, { immediate: true })

function preview() {
  error.value = ''
  if (valid.value) emit('change', { ...draft.value })
}

function updateField(field: EditField, event: Event) {
  const input = event.target as HTMLInputElement
  const type = editFieldType(field)
  draft.value[field.key] = type === 'boolean'
    ? input.checked
    : type === 'number' || type === 'integer'
      ? input.value === '' ? '' : Number(input.value)
      : input.value
  preview()
}

function resetDefaults() {
  draft.value = editFieldValues(props.fields)
  preview()
}

async function submit() {
  if (saving.value || !valid.value) return
  saving.value = true
  error.value = ''
  const values = { ...draft.value }
  try {
    await props.save(values)
    emit('saved', values)
    opened.value = false
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '保存失败，请重试。'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppPopup
    v-model:open="opened"
    class="edit-popup"
    mode="popover"
    :anchor="anchor"
    :title="title"
    :dismissible="!saving"
    :close-on-outside="false"
  >
    <template #header-actions>
      <button
        class="button edit-popup__icon"
        type="button"
        title="恢复默认"
        aria-label="恢复默认"
        :disabled="saving"
        @click="resetDefaults"
      >
        <Icon
          name="lucide:rotate-ccw"
          aria-hidden="true"
        />
      </button>
      <button
        class="button button--primary edit-popup__icon"
        type="submit"
        :form="formId"
        :title="saving ? '正在保存……' : '保存设置'"
        aria-label="保存设置"
        :aria-busy="saving"
        :disabled="saving || !valid"
      >
        <Icon
          name="lucide:check"
          aria-hidden="true"
        />
      </button>
    </template>
    <template #default>
      <form
        :id="formId"
        class="panel-stack"
        @submit.prevent="submit"
      >
        <fieldset
          class="panel-stack"
          :disabled="saving"
        >
          <label
            v-for="field in fields"
            :key="field.key"
            class="form-field"
          >
            <span>{{ field.label }}</span>
            <template v-if="editFieldType(field) === 'number' || editFieldType(field) === 'integer'">
              <input
                v-if="field.min !== undefined && field.max !== undefined"
                type="range"
                :aria-label="`${field.label}滑块`"
                :value="draft[field.key]"
                :min="field.min"
                :max="field.max"
                :step="editFieldStep(field)"
                @input="updateField(field, $event)"
              >
              <input
                class="form-control"
                type="number"
                :aria-label="field.label"
                :value="draft[field.key]"
                :min="field.min"
                :max="field.max"
                :step="field.step ?? (editFieldType(field) === 'integer' ? 1 : 'any')"
                :aria-invalid="Boolean(errors[field.key])"
                required
                @input="updateField(field, $event)"
              >
            </template>
            <input
              v-else-if="editFieldType(field) === 'boolean'"
              type="checkbox"
              :checked="Boolean(draft[field.key])"
              @change="updateField(field, $event)"
            >
            <input
              v-else
              class="form-control"
              type="text"
              :value="draft[field.key]"
              @input="updateField(field, $event)"
            >
            <small class="field-help">默认：{{ field.defaultValue }}<template v-if="field.description"> · {{ field.description }}</template></small>
            <small
              v-if="errors[field.key]"
              class="edit-popup__error"
              role="alert"
            >{{ errors[field.key] }}</small>
          </label>
        </fieldset>
        <p
          v-if="error"
          class="edit-popup__error"
          role="alert"
        >
          {{ error }}
        </p>
      </form>
    </template>
  </AppPopup>
</template>

<style scoped>
.edit-popup.app-popup {
  --popup-width: 360px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--background-secondary);
}
.edit-popup p { margin: 0; }
.edit-popup input[type='range'] { width: 100%; accent-color: var(--accent-color); }
.edit-popup__icon { width: 36px; height: 36px; padding: 0; }
.edit-popup__error { margin: 0; color: #b91c1c; font-size: 12px; }
</style>
