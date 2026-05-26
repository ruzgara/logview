import PocketBase from 'pocketbase'

export const pb = (import.meta.env.VITE_PB_URL) ? new PocketBase(import.meta.env.VITE_PB_URL) : new PocketBase()

// Sign out on any 401 (expired/revoked token mid-session). Clearing the auth
// store fires authStore.onChange, which routes the user back to the AuthScreen.
pb.afterSend = (response, data) => {
  if (response.status === 401) {
    pb.authStore.clear()
  }
  return data
}
