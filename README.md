# 简谱工作室 (Jianpu Studio)

基于 [journey-ad/jianpu](https://github.com/journey-ad/jianpu) **魔改增强**的 Web 数字简谱编辑器：在原版「数字简谱 → 钢琴试听」之上，重做界面与功能，适合学习与即兴弹奏。

> 原版项目已归档，仅保留核心 `jianpu()` 播放思路；本仓库为独立演进版本，**非官方维护**。

## 在线体验

**https://realoliva.github.io/jianpu-studio/**

本地运行：双击 `start.bat` 或 `python -m http.server 8765`，打开 http://localhost:8765/

## 相对原版的增强

| 功能 | 说明 |
|------|------|
| 桌面式 UI | 曲库、编辑器、说明三栏 + 底栏满宽 88 键钢琴 |
| 魔法光效钢琴 | 播放/点击时 Canvas 光晕、粒子迸发 |
| 键盘弹奏 | 数字键 `1–7`、字母键 `Z–M` 低音 / `Q–U` 高音等（见应用内说明） |
| 线稿转数字谱 | 画布绘制旋律曲线，一键转为简谱文本 |
| 曲库导入导出 | 示例曲 + 自定义曲目 `.jianpu-library.json` |
| 单首导入导出 | 当前编辑 `.jianpu.json` |
| Electron 打包 | 见 [PACKAGING.md](./PACKAGING.md) |

## 数字简谱规则（C 大调）

- `1`–`7`：中音 do–si  
- `#`：升半音  
- `(5)` / `[1]`：低/高八度  
- 空格、`-`、换行：休止  

## 技术栈

- 纯静态 HTML / CSS / JavaScript  
- Web Audio API + `media/piano.wav`（[Berklee samples v.4](https://archive.org/details/Berklee44v4)）  

## 许可

- 本项目代码：MIT（见 [LICENSE](./LICENSE)）  
- 钢琴采样：遵循原项目所列第三方许可  

## 致谢

- [journey-ad/jianpu](https://github.com/journey-ad/jianpu) — 最初灵感与播放引擎思路  
- [metasj / Berklee samples](https://archive.org/details/Berklee44v4) — 音源  
