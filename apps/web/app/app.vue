<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'zh-CN'
  }
})

const title = 'YuTD'
const description = 'YuTD 任务管理应用'
const { update } = useSystemTime()

let clockTimer: ReturnType<typeof setInterval> | undefined

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    update()
  }
}

onMounted(() => {
  update()
  clockTimer = setInterval(update, 60_000)

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange
  )
})

onBeforeUnmount(() => {
  if (clockTimer !== undefined) {
    clearInterval(clockTimer)
  }

  document.removeEventListener(
    'visibilitychange',
    handleVisibilityChange
  )
})

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
