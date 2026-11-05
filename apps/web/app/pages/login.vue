<script setup lang="ts">
import { requestApiData } from '~/utils/api'

const { $api } = useNuxtApp()
const { reportError } = useAppErrors()
const route = useRoute()
const authToken = useCookie<string | null>('yutd-auth-token', { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 })
const password = ref('')
const pending = ref(false)
const error = ref('')

async function login() {
  if (pending.value || !password.value) return
  pending.value = true
  error.value = ''
  try {
    const result = await requestApiData($api.api.auth.login.post({ password: password.value }), '验证失败')
    if (!result.token) throw new Error('服务器未返回登录凭证')
    authToken.value = result.token
    password.value = ''
    await nextTick()
    const redirect = route.query.redirect
    const target = typeof redirect === 'string' && /^\/(?!\/)/.test(redirect) && !/[\\\r\n]/.test(redirect)
      && !/^\/login\/?(?:[?#]|$)/.test(redirect)
      ? redirect
      : '/'
    // 重新进入应用，让服务端和 API 客户端都读取刚保存的 Cookie。
    await navigateTo(target, { external: true, replace: true })
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '验证失败，请重试'
    reportError(reason, '登录验证失败')
  } finally {
    pending.value = false
  }
}

useHead({ title: '登录 · YuTD' })
</script>

<template>
  <main class="login-page">
    <form
      class="login-form"
      :aria-busy="pending"
      @submit.prevent="login"
    >
      <h1>登录 YuTD</h1>
      <p class="muted">
        权限不足，请输入服务器密码以继续访问。
      </p>
      <label for="password">服务器密码</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        autofocus
        required
        :disabled="pending"
      >
      <p
        v-if="error"
        class="login-error"
        role="alert"
      >
        {{ error }}
      </p>
      <button
        class="button"
        type="submit"
        :disabled="pending || !password"
      >
        {{ pending ? '正在验证……' : '验证并返回' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login-page { display: grid; min-height: 100dvh; place-items: center; padding: 24px; }
.login-form { display: grid; gap: 16px; width: min(100%, 380px); padding: 28px; border: 1px solid var(--border-color); border-radius: 16px; background: var(--background-secondary); }
.login-form h1 { margin: 0; font-size: 24px; }
.login-form label { font-size: 14px; }
.login-form input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--background-primary); color: var(--text-primary); }
.login-error { margin: 0; color: #b42336; font-size: 14px; }
</style>
