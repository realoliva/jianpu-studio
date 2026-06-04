# 打包为 Windows exe

## 方式一：便携 exe（推荐）

```powershell
cd "项目目录\jianpu"
npm install
npm run dist
```

生成文件：`dist/简谱工作室-1.0.0-便携版.exe`（单文件，免安装）

## 方式二：安装包

```powershell
npm run dist:installer
```

## 开发调试桌面版

```powershell
npm start
```

## 方式三：仅浏览器（当前）

双击 `start.bat` 或：

```powershell
python -m http.server 8080
```

浏览器打开 http://localhost:8080/

---

**说明**：Web 版与 Electron 版共用 `index.html`、`js/`、`media/`，导出 `.jianpu.json` 格式一致。
