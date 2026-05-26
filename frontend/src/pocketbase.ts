import PocketBase from 'pocketbase'
export const pb = (import.meta.env.VITE_PB_URL) ? new PocketBase(import.meta.env.VITE_PB_URL) : new PocketBase()