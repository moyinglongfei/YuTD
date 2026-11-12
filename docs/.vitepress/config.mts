import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'YuTD',
  description: 'YuTD 项目概览与开发者文档',
  themeConfig: {
    nav: [
      { text: '概览', link: '/overview' },
      { text: '开发者', link: '/developer/data-structure', activeMatch: '/developer/' }
    ],

    sidebar: [
      {
        text: '概览',
        items: [
          { text: '项目介绍', link: '/overview' }
        ]
      },
      {
        text: '开发者',
        items: [
          { text: '数据结构', link: '/developer/data-structure' },
          {
            text: 'Web',
            items: [
              { text: '前端 · Vue / Nuxt', link: '/developer/web/frontend' },
              { text: '后端 · Bun / Elysia', link: '/developer/web/backend' }
            ]
          },
          {
            text: 'Android',
            items: [
              { text: '前端 · Capacitor / Nuxt', link: '/developer/android/frontend' },
              { text: '本地后端 · Kotlin / Room', link: '/developer/android/backend' }
            ]
          }
        ]
      }
    ],

    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一篇', next: '下一篇' },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/moyinglongfei/YuTD' }
    ]
  }
})
