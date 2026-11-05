export const RESOURCE_TYPES = ['image', 'task', 'event', 'phase', 'tip', 'style'] as const
export type ResourceType = typeof RESOURCE_TYPES[number]
export type ResourceSelection = ResourceType | 'all'
export type ResourceSort = 'updatedAt' | 'createdAt'

export const RESOURCE_LABELS: Record<ResourceSelection, string> = {
  all: '全部资源', image: '图片', task: '任务', event: '事件', phase: '阶段', tip: '提示', style: '样式'
}

export interface ResourceQuery {
  type?: ResourceSelection
  sort?: ResourceSort
  search?: string
  tag?: string
  limit?: number
  offset?: number
}
