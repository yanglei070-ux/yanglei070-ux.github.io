import { contextBridge, ipcRenderer } from 'electron'

export interface LeoApi {
  version: string
  platform: string
  categories: () => Promise<{ l1: string; l2: string }[]>
  addExpense: (e: { amount: number; l1: string; l2: string; note?: string; spentAt: string }) => Promise<number>
  updateExpense: (id: number, e: { amount: number; l1: string; l2: string; note?: string; spentAt: string }) => Promise<void>
  listExpenses: (filter?: { yearMonth?: string; l1?: string; l2?: string }) => Promise<Array<{
    id: number; amount: number; l1: string; l2: string; note: string; spentAt: string; createdAt: string
  }>>
  deleteExpense: (id: number) => Promise<void>
  summaryByL1: (ym: string) => Promise<{ l1: string; amount: number }[]>
  summaryByDay: (ym: string) => Promise<{ day: string; amount: number }[]>
  summaryByWeek: (ym: string) => Promise<{ weekLabel: string; amount: number }[]>
  summaryByMonth: (limit?: number) => Promise<{ month: string; amount: number }[]>
  summaryByL2: (ym: string) => Promise<{ l1: string; l2: string; amount: number }[]>
  monthTotal: (ym: string) => Promise<number>
  availableMonths: () => Promise<string[]>
  getSetting: (key: string) => Promise<string | null>
  setSetting: (key: string, value: string) => Promise<void>
  exportCSV: (ym?: string) => Promise<boolean>
  importExpenses: (list: Array<{ amount: number; l1: string; l2: string; note?: string; spentAt: string }>) => Promise<number>
}

const api: LeoApi = {
  version: '0.0.0',
  platform: process.platform,
  categories: () => ipcRenderer.invoke('leo:categories'),
  addExpense: (e) => ipcRenderer.invoke('leo:addExpense', e),
  updateExpense: (id, e) => ipcRenderer.invoke('leo:updateExpense', id, e),
  listExpenses: (filter) => ipcRenderer.invoke('leo:listExpenses', filter),
  deleteExpense: (id) => ipcRenderer.invoke('leo:deleteExpense', id),
  summaryByL1: (ym) => ipcRenderer.invoke('leo:summaryByL1', ym),
  summaryByDay: (ym) => ipcRenderer.invoke('leo:summaryByDay', ym),
  summaryByWeek: (ym) => ipcRenderer.invoke('leo:summaryByWeek', ym),
  summaryByMonth: (limit) => ipcRenderer.invoke('leo:summaryByMonth', limit),
  summaryByL2: (ym) => ipcRenderer.invoke('leo:summaryByL2', ym),
  monthTotal: (ym) => ipcRenderer.invoke('leo:monthTotal', ym),
  availableMonths: () => ipcRenderer.invoke('leo:availableMonths'),
  getSetting: (key) => ipcRenderer.invoke('leo:getSetting', key),
  setSetting: (key, value) => ipcRenderer.invoke('leo:setSetting', key, value),
  exportCSV: (ym) => ipcRenderer.invoke('leo:exportCSV', ym),
  importExpenses: (list) => ipcRenderer.invoke('leo:importExpenses', list)
}

contextBridge.exposeInMainWorld('leo', api)
