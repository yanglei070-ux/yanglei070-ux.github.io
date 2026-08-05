# leo记账

一个简单、本地优先的个人记账桌面 App,记录每一笔花销并按分类统计。
基于 Electron + React + TypeScript + SQLite(sql.js)。

## 功能(第一期)

- 记一笔支出:金额(¥)、二级分类、备注、日期(默认今天)
- 二级分类:10 大类 / 52 小类(餐饮、交通、购物、居家、娱乐、医疗、人情、学习、金融、其他)
- 按月查看记录,支持编辑、删除
- 统计:本月总支出、按一级分类占比饼图、按日趋势条形图
- 数据存在本地(用户数据目录下的 `leo.db`),离线可用

## 环境要求

- Node.js 18+ 与 npm(本机已装 Node 24 / npm 11)

## 开发运行

```bash
cd leo-app
npm install        # 首次安装依赖
npm run dev        # 启动开发模式,自动弹出 App 窗口
```

## 生产构建

```bash
cd leo-app
npm run build      # 产出在 out/ 目录
```

## 目录结构

详见根目录 `CLAUDE.md` 的第六节。

## 关于数据库驱动

使用 sql.js(纯 WebAssembly 的 SQLite),无需本机 C++ 工具链即可运行。
数据访问全部隔离在 `electron/db.ts`,将来装好 Visual Studio Build Tools 后
可平滑换回 better-sqlite3(更快),只改该文件。
