<script setup lang="ts">
import type { ScheduleForm } from '~/utils/schedule'

const props = defineProps<{
  disabled?: boolean
}>()

const form = defineModel<ScheduleForm>({ required: true })

const weekday = weekdays.map((label, index) => ({ label, value: index + 1 }))
</script>

<template>
  <fieldset
    :disabled="props.disabled"
    class="grid gap-4 sm:grid-cols-2"
  >
    <UFormField
      label="星期"
      required
    >
      <USelect
        v-model="form.weekday"
        :items="weekday"
        :disabled="props.disabled"
        class="w-full"
      />
    </UFormField>
    <UFormField
      label="存在周数"
      help="用逗号或空格分隔，例如 1, 2, 3"
      required
    >
      <UInput
        v-model="form.weeks"
        placeholder="1, 2, 3"
        class="w-full"
        required
      />
    </UFormField>
    <UFormField
      label="开始时间"
      required
    >
      <UInput
        v-model="form.startTime"
        type="time"
        class="w-full"
        required
      />
    </UFormField>
    <UFormField
      label="结束时间"
      required
    >
      <UInput
        v-model="form.endTime"
        type="time"
        class="w-full"
        required
      />
    </UFormField>
    <UFormField
      label="地点"
      class="sm:col-span-2"
    >
      <UInput
        v-model="form.location"
        placeholder="选填，单独指定本次日程地点"
        class="w-full"
      />
    </UFormField>
  </fieldset>
</template>
