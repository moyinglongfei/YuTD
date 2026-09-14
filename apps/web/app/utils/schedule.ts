export function createScheduleForm() {
  return {
    weekday: 1,
    startTime: '',
    endTime: '',
    weeks: '',
    location: ''
  }
}

export type ScheduleForm = ReturnType<typeof createScheduleForm>

export function getScheduleData(form: ScheduleForm) {
  if (!Number.isInteger(form.weekday) || form.weekday < 1 || form.weekday > 7)
    throw new Error('请选择星期')

  if (!form.startTime || !form.endTime)
    throw new Error('请选择开始时间和结束时间')

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.startTime)
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.endTime))
    throw new Error('时间格式无效')

  if (form.startTime >= form.endTime)
    throw new Error('结束时间必须晚于开始时间')

  const weeks = form.weeks.trim().split(/[,，\s]+/).filter(Boolean).map(Number)

  if (!weeks.length)
    throw new Error('请输入存在周数')

  if (weeks.some(week => !Number.isInteger(week) || week < 1))
    throw new Error('存在周数必须是大于等于 1 的整数')

  if (new Set(weeks).size !== weeks.length)
    throw new Error('存在周数不能重复')

  return {
    weekday: form.weekday,
    startTime: form.startTime,
    endTime: form.endTime,
    weeks,
    location: form.location.trim() || undefined
  }
}
