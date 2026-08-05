// 让 TypeScript 认到 preload 注入的 window.leo
declare global {
  interface Window {
    leo: {
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
  }
}

export {}
