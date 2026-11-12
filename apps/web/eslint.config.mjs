// @ts-check
import { globalIgnores } from 'eslint/config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  globalIgnores(['android/**'])
  // Your custom configs here
)
