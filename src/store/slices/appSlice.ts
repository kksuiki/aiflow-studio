import { StateCreator } from 'zustand'
import { message } from 'antd'
import { Application, CreateAppForm } from '../../types'
import request from '../../utils/axios'

const RETRY_COUNT = 3
const RETRY_DELAY = 1000

/** 带重试的请求封装 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = RETRY_COUNT,
  delay = RETRY_DELAY,
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('unreachable')
}

export interface AppSlice {
  apps: Application[]
  currentApp: Application | null
  isLoading: boolean
  
  // Actions
  setApps: (apps: Application[]) => void
  setCurrentApp: (app: Application | null) => void
  fetchApps: () => Promise<Application[]>
  fetchAppById: (id: string) => Promise<Application>
  createApp: (data: CreateAppForm) => Promise<Application>
  updateApp: (id: string, data: Partial<CreateAppForm>) => Promise<Application>
  deleteApp: (id: string) => Promise<void>
  publishApp: (id: string) => Promise<void>
  unpublishApp: (id: string) => Promise<void>
}

export const createAppSlice: StateCreator<AppSlice> = (set, get) => ({
  apps: [],
  currentApp: null,
  isLoading: false,

  setApps: (apps) => set({ apps }),
  
  setCurrentApp: (app) => set({ currentApp: app }),

  fetchApps: async () => {
    set({ isLoading: true })
    try {
      const response = await withRetry(() => request.get('/apps') as Promise<any>)
      const apps = (Array.isArray(response.data) ? response.data : []) as Application[]
      set({ apps, isLoading: false })
      return apps
    } catch (error) {
      set({ isLoading: false, apps: [] })
      message.error('获取应用列表失败，请检查网络后刷新页面重试')
      throw error
    }
  },

  fetchAppById: async (id) => {
    set({ isLoading: true })
    try {
      const response = await request.get(`/apps/${id}`) as any
      const app = response.data as Application
      set({ currentApp: app, isLoading: false })
      return app
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createApp: async (data) => {
    set({ isLoading: true })
    try {
      const response = await request.post('/apps', data) as any
      const app = response.data as Application
      const currentApps = Array.isArray(get().apps) ? get().apps : []
      set({ apps: [...currentApps, app], isLoading: false })
      return app
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  updateApp: async (id, data) => {
    set({ isLoading: true })
    try {
      const response = await request.patch(`/apps/${id}`, data) as any
      const updatedApp = response.data as Application
      const currentApps = Array.isArray(get().apps) ? get().apps : []
      
      set({
        apps: currentApps.map((app) => app.id === id ? updatedApp : app),
        currentApp: get().currentApp?.id === id ? updatedApp : get().currentApp,
        isLoading: false,
      })
      
      return updatedApp
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  deleteApp: async (id) => {
    set({ isLoading: true })
    try {
      await request.delete(`/apps/${id}`)
      const currentApps = Array.isArray(get().apps) ? get().apps : []
      set({
        apps: currentApps.filter((app) => app.id !== id),
        currentApp: get().currentApp?.id === id ? null : get().currentApp,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },
  
  publishApp: async (id) => {
    set({ isLoading: true })
    try {
      const response = await request.patch(`/apps/${id}/publish`) as any
      const updatedApp = response.data as Application
      const currentApps = Array.isArray(get().apps) ? get().apps : []
      set({
        apps: currentApps.map((app) => app.id === id ? updatedApp : app),
        currentApp: get().currentApp?.id === id ? updatedApp : get().currentApp,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },
  
  unpublishApp: async (id) => {
    set({ isLoading: true })
    try {
      const response = await request.patch(`/apps/${id}/unpublish`) as any
      const updatedApp = response.data as Application
      const currentApps = Array.isArray(get().apps) ? get().apps : []
      set({
        apps: currentApps.map((app) => app.id === id ? updatedApp : app),
        currentApp: get().currentApp?.id === id ? updatedApp : get().currentApp,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },
})
