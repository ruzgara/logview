export type ConnectionRecord = {
  id: string
  real_ip?: string
  country?: string
  address?: string
  path?: string
  router?: string
  service?: string
  created?: string
}

export type RouterRecord = {
  id: string
  name: string
}

export type ServiceRecord = {
  id: string
  name: string
}
