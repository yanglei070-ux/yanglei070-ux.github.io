import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { openDatabase, listCategories, addExpense, listExpenses, deleteExpense, updateExpense, summaryByL1, summaryByDay, summaryByWeek, summaryByMonth, summaryByL2, monthTotal, availableMonths, getSetting, setSetting, exportExpensesCSV, importExpenses, type Expense } from './db'

// 打包为 CommonJS,__dirname 由运行时提供,无需从 import.meta.url 推导

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1150,
    height: 780,
    title: 'leo记账',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    win.center()
    win.show()
    win.focus()
    win.setAlwaysOnTop(true)
    setTimeout(() => {
      win.setAlwaysOnTop(false)
    }, 1000)
  })

  // 把渲染进程的 console 与加载失败转发到终端,方便排查白屏
  win.webContents.on('console-message', (_e, _lvl, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`)
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[renderer] 加载失败 ${code} ${desc} -> ${url}`)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.on('did-finish-load', () => win.webContents.openDevTools())
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// IPC:界面通过 window.leo 调用这些
ipcMain.handle('leo:categories', () => listCategories())
ipcMain.handle('leo:addExpense', (_e, e: Omit<Expense, 'id' | 'createdAt'>) => addExpense(e))
ipcMain.handle('leo:updateExpense', (_e, id: number, e: Omit<Expense, 'id' | 'createdAt'>) => updateExpense(id, e))
ipcMain.handle('leo:listExpenses', (_e, filter?: { yearMonth?: string; l1?: string; l2?: string }) => listExpenses(filter))
ipcMain.handle('leo:deleteExpense', (_e, id: number) => deleteExpense(id))
ipcMain.handle('leo:summaryByL1', (_e, ym: string) => summaryByL1(ym))
ipcMain.handle('leo:summaryByDay', (_e, ym: string) => summaryByDay(ym))
ipcMain.handle('leo:summaryByWeek', (_e, ym: string) => summaryByWeek(ym))
ipcMain.handle('leo:summaryByMonth', (_e, limit?: number) => summaryByMonth(limit))
ipcMain.handle('leo:summaryByL2', (_e, ym: string) => summaryByL2(ym))
ipcMain.handle('leo:monthTotal', (_e, ym: string) => monthTotal(ym))
ipcMain.handle('leo:availableMonths', () => availableMonths())
ipcMain.handle('leo:getSetting', (_e, key: string) => getSetting(key))
ipcMain.handle('leo:setSetting', (_e, key: string, val: string) => setSetting(key, val))
ipcMain.handle('leo:exportCSV', async (_e, ym?: string) => {
  const csvStr = exportExpensesCSV(ym)
  const defaultName = ym ? `leo记账_${ym}.csv` : 'leo记账_全部记录.csv'
  const res = await dialog.showSaveDialog({
    title: '导出记账 CSV 文件',
    defaultPath: defaultName,
    filters: [{ name: 'CSV 表格文件', extensions: ['csv'] }]
  })
  if (!res.canceled && res.filePath) {
    fs.writeFileSync(res.filePath, csvStr, 'utf-8')
    return true
  }
  return false
})
ipcMain.handle('leo:importExpenses', (_e, list: Array<Omit<Expense, 'id' | 'createdAt'>>) => importExpenses(list))

app.whenReady().then(async () => {
  await openDatabase()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
