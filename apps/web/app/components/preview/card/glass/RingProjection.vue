// 通用卡片的边缘折射效果的渲染
<script setup lang="ts">
import type { RingProjectionData } from './edges'

defineProps<{
  projection: RingProjectionData
  colorCss: string
}>()
const projectionId = useId().replace(/:/g, '')
</script>

<template>
  <svg
    class="ring-projection"
    :viewBox="`0 0 ${projection.width} ${projection.height}`"
  >
    <defs>
      <clipPath :id="`${projectionId}-clip`">
        <path
          :d="projection.clip"
          fill-rule="evenodd"
          clip-rule="evenodd"
        />
      </clipPath>
      <mask
        :id="`${projectionId}-fade`"
        maskUnits="userSpaceOnUse"
        maskContentUnits="userSpaceOnUse"
        x="0"
        y="0"
        :width="projection.width"
        :height="projection.height"
        style="mask-type: alpha"
      >
        <rect
          v-for="(band, index) in projection.bands"
          :key="index"
          :x="band.inset"
          :y="band.inset"
          :width="band.width"
          :height="band.height"
          :rx="band.radius"
          fill="none"
          stroke="white"
          :stroke-width="band.strokeWidth"
          :stroke-opacity="band.opacity"
        />
      </mask>
      <linearGradient
        v-for="(patch, index) in projection.patches"
        :id="`${projectionId}-patch-${index}`"
        :key="index"
        gradientUnits="userSpaceOnUse"
        :x1="patch.start.x"
        :y1="patch.start.y"
        :x2="patch.end.x"
        :y2="patch.end.y"
      >
        <stop
          offset="0"
          :stop-color="colorCss"
          :stop-opacity="patch.startOpacity"
        />
        <stop
          offset="1"
          :stop-color="colorCss"
          :stop-opacity="patch.endOpacity"
        />
      </linearGradient>
    </defs>
    <g
      :clip-path="`url(#${projectionId}-clip)`"
      :mask="`url(#${projectionId}-fade)`"
    >
      <path
        v-for="(patch, index) in projection.patches"
        :key="index"
        :d="patch.path"
        :fill="`url(#${projectionId}-patch-${index})`"
      />
    </g>
  </svg>
</template>

<style scoped>
.ring-projection {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}
</style>
