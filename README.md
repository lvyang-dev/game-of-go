# 榧木師範 — 圍棋對弈與 AI 指導 (Kaya Sensei Go)

零後端、純瀏覽器運行的繁體中文圍棋對弈、即時 AI 指導教練與 15 題實戰道場，內建 **ONNX Runtime Web（WebGPU / WASM）神經網路引擎**，可直接於另一台電腦離線運行或部署至 **GitHub Pages**。

---

## 如何在另一台電腦上執行？

本專案提供兩種在另一台電腦運行的途徑，依照您的需求選擇最便利的方式：

### 方法一：單檔直接執行（最推薦、最簡單、免安裝）

專案根目錄中的 **`kaya-sensei-go.html`** 是將所有 HTML、CSS 樣式、JavaScript 邏輯（包含完整圍棋規則、MCTS AI、15 題繁體中文道場、語音音效與 ONNX Web 加載器）打包為單一文件的自給自足版本。

#### 操作步驟：
1. **將檔案傳送至另一台電腦**：
   - 僅需將 **`kaya-sensei-go.html`** 單一檔案複製傳送到另一台電腦（透過 USB 隨身碟、AirDrop、Email、LINE、Google Drive 等皆可）。
2. **直接開啟**：
   - 在另一台電腦上，**連按兩下（雙擊）** `kaya-sensei-go.html`。
   - 檔案會立即以預設瀏覽器（Chrome、Edge、Safari、Firefox）開啟並開始遊玩！
   - 不需要安裝 Node.js、不需要 Python、完全不需要打開終端機或命令提示字元。

> 💡 **提示**：若您日後在開發時修改了個別 `.js` 或 `.css` 模組，只需在原本電腦執行：
> ```bash
> python3 build_standalone.py
> ```
> 即可自動重新產生最新的 `kaya-sensei-go.html`。

---

### 方法二：完整專案資料夾本地執行（開發者／模組化模式）

若您希望在另一台電腦上保留完整的原始碼結構（包含各個 ES 模組獨立檔案），由於現代瀏覽器的跨來源安全性限制（CORS / ES Module Security Policy），直接以 `file://` 開啟 `index.html` 可能會阻擋模組載入，因此需要透過本地簡易 HTTP 伺服器開啟。

#### 1. 複製專案資料夾
將整份 `Game of Go` 資料夾壓縮打包後傳送到另一台電腦並解壓縮。

#### 2. 在該電腦啟動本地 HTTP 伺服器（任選一種工具）

##### 【選項 A：使用 Python】（Mac / Linux / Windows 適用）
打開終端機（macOS / Linux）或命令提示字元／PowerShell（Windows），切換至專案解壓縮目錄：

- **macOS / Linux**：
  ```bash
  cd "Game of Go"
  python3 -m http.server 8765
  ```

- **Windows**：
  ```cmd
  cd "Game of Go"
  python -m http.server 8765
  # 若上方指令無效，請嘗試：
  py -m http.server 8765
  ```

##### 【選項 B：使用 Node.js / npx】（若電腦有安裝 Node.js）
```bash
cd "Game of Go"
npx serve -l 8765
# 或者
npx http-server -p 8765
```

##### 【選項 C：使用 VS Code Live Server 擴充套件】
若另一台電腦安裝了 VS Code：
1. 用 VS Code 開啟 `Game of Go` 資料夾。
2. 在右下角點擊 **"Go Live"**（需安裝 Live Server 擴充功能）。
3. 瀏覽器會自動開啟 `http://127.0.0.1:5500/`。

#### 3. 開啟瀏覽器
伺服器啟動後，在瀏覽器網址列輸入並前往：
```text
http://localhost:8765/
```

---

### 方法三：線上無痛遊玩 — 部署至 GitHub Pages

如果您不想手動傳送檔案，可以直接將本專案託管在 GitHub Pages 上，如此一來在任何電腦、手機或平板只要打開網址就能直接玩：

1. 將本專案推送（push）至您的 GitHub 儲存庫（Repository）。
2. 在 GitHub 儲存庫頁面，前往 **Settings（設定）→ Pages**。
3. 在 **Build and deployment** 下方的 **Branch** 選擇 `main`（或 `master`），目錄選擇 `/ (root)`，並點擊 **Save**。
4. 等待約 1 分鐘後，即可透過專屬網址隨時隨地開啟：
   ```text
   https://<您的GitHub使用者名稱>.github.io/<儲存庫名稱>/
   ```
> 🌟 **GitHub Pages 特色優勢**：GitHub Pages 預設提供 HTTPS 加密連線，能完整啟用現代瀏覽器的最高效能 **WebGPU** 硬體加速以及 Cache Storage API，載入神經網路模型時速度最快、體驗最佳。

---

## 跨電腦存檔與設定說明

- **棋盤尺寸與遊戲設定記憶**：遊戲會自動透過瀏覽器的 `localStorage` 記錄您上次選擇的棋盤尺寸（19x19、13x13、9x9）以及 AI 對弈難度設定，下次開啟同一瀏覽器時會自動還原。
- **道場闖關進度**：各題的過關狀態與星號評價同樣保存在當前電腦的瀏覽器中。在另一台電腦開啟時將會是獨立的全新進度。

---

## 啟用瀏覽器端神經網路 AI（KataGo ONNX）

遊戲預設使用內建輕量規則＋蒙地卡羅搜尋（MCTS）引擎（開箱即玩、零等待）。若想要提升至段位／職業等級的下子與局勢評估，可隨時在右側面板的 **「神經網路 AI 引擎」** 卡片啟用 ONNX 模型：

- **方式 A（推薦於 GitHub Pages / 本地伺服器）**：將轉換好的 KataGo V7 `.onnx` 模型放入 `models/katago.onnx`，點選介面中的 **「載入神經網路」** 即可自動讀取並快取於瀏覽器（下次開啟秒載入）。
- **方式 B（Hugging Face 直連）**：直接於下拉選單選擇 `KataGo b28c512 FP16（Hugging Face）` 或輸入任意支援 CORS 的 `.onnx` HTTPS 下載連結。
- **方式 C（本機檔案選取）**：點擊 **「本機 .onnx」** 直接從電腦檔案選取 `.onnx` 模型檔。計算全程於瀏覽器內部運行（WebGPU / WASM），不會上傳到任何伺服器。

> 🛠️ **若欲自行從官方 KataGo `.bin.gz` 權重匯出 `.onnx` 模型**，可使用 KataGo v1.18+ 內建指令：
> ```bash
> katago dumponnx -model model.bin.gz -out models/katago.onnx
> ```
