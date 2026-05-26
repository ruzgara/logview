import PocketBase from 'pocketbase'

export const pb = import.meta.env.VITE_PB_URL
  ? new PocketBase(import.meta.env.VITE_PB_URL)
  : new PocketBase()

pb.beforeSend = (url, options) => ({
  url,
  options: {
    ...options,
    headers: {
      ...options.headers,
      ...(pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {}),
    },
  },
})

pb.afterSend = (response, data) => {
  if (response.status === 401) pb.authStore.clear()
  return data
}
