"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntropySidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
const scorer_1 = require("../scorer");
/**
 * Provides the Entropy Tracker sidebar webview panel.
 *
 * Displays a ranked list of the highest-entropy files with:
 * - Colored severity dots
 * - Sparklines showing score history
 * - Detail view with metric cards, topic tags, author breakdown, and suggestions
 */
class EntropySidebarProvider {
    constructor(extensionUri, db, log) {
        this.extensionUri = extensionUri;
        this.db = db;
        this.log = log;
    }
    /**
     * Called when the webview view is first created.
     */
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'ready':
                    this.sendData();
                    break;
                case 'openFile':
                    this.openFile(message.path);
                    break;
                case 'requestDetail':
                    this.sendDetailData(message.path);
                    break;
                case 'refresh':
                    vscode.commands.executeCommand('entropy.refresh');
                    break;
            }
        });
    }
    /**
     * Refreshes the sidebar data after analysis completes.
     */
    refresh() {
        if (this._view) {
            this.sendData();
        }
    }
    /**
     * Sends the top files list to the webview.
     */
    sendData() {
        if (!this._view) {
            return;
        }
        const topFiles = this.db.getTopFiles(10);
        const filesWithHistory = topFiles.map((file) => {
            const history = this.db.getScoreHistory(file.path, 12);
            return {
                ...file,
                severity: (0, scorer_1.getSeverity)(file.score),
                badge: (0, scorer_1.getSeverityBadge)((0, scorer_1.getSeverity)(file.score)),
                history: history.map((h) => h.score),
            };
        });
        this._view.webview.postMessage({
            command: 'updateFiles',
            files: filesWithHistory,
        });
    }
    /**
     * Sends detailed data for a specific file to the webview.
     */
    sendDetailData(filePath) {
        if (!this._view) {
            return;
        }
        const fileData = this.db.getScore(filePath);
        if (!fileData) {
            return;
        }
        const history = this.db.getScoreHistory(filePath, 12);
        this._view.webview.postMessage({
            command: 'showDetail',
            file: {
                ...fileData,
                severity: (0, scorer_1.getSeverity)(fileData.score),
                badge: (0, scorer_1.getSeverityBadge)((0, scorer_1.getSeverity)(fileData.score)),
                history: history.map((h) => h.score),
            },
        });
    }
    /**
     * Opens a file in the editor.
     */
    async openFile(filePath) {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
            await vscode.window.showTextDocument(fileUri);
        }
        catch (error) {
            this.log.appendLine(`[Sidebar] Error opening file: ${error}`);
        }
    }
    /**
     * Generates the full HTML for the sidebar webview.
     */
    getHtml(_webview) {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Entropy Tracker</title>
  <style>
    /* ========== RESET & BASE ========== */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background, var(--vscode-editor-background));
      line-height: 1.5;
      overflow-x: hidden;
    }

    /* ========== HEADER ========== */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
      position: sticky;
      top: 0;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      z-index: 10;
    }

    .header-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
      opacity: 0.85;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }

    .icon-btn {
      background: none;
      border: none;
      color: var(--vscode-icon-foreground, var(--vscode-foreground));
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 14px;
      opacity: 0.7;
      transition: opacity 0.15s, background 0.15s;
    }

    .icon-btn:hover {
      opacity: 1;
      background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.1));
    }

    /* ========== LOADING STATE ========== */
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 16px;
      gap: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--vscode-progressBar-background, #0078d4);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ========== EMPTY STATE ========== */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      text-align: center;
      gap: 8px;
    }

    .empty-state .icon {
      font-size: 32px;
      opacity: 0.5;
      margin-bottom: 8px;
    }

    .empty-state .title {
      font-weight: 600;
      font-size: 14px;
    }

    .empty-state .subtitle {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    /* ========== FILE LIST ========== */
    .file-list {
      list-style: none;
    }

    .file-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.05));
      transition: background 0.15s;
      position: relative;
    }

    .file-item:hover {
      background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.05));
    }

    .file-item.active {
      background: var(--vscode-list-activeSelectionBackground, rgba(0,120,212,0.2));
    }

    .rank {
      font-size: 10px;
      font-weight: 700;
      color: var(--vscode-descriptionForeground);
      min-width: 16px;
      text-align: center;
    }

    .severity-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .severity-dot.critical {
      background: var(--vscode-errorForeground, #f44747);
      box-shadow: 0 0 6px var(--vscode-errorForeground, #f44747);
    }

    .severity-dot.warning {
      background: var(--vscode-problemsWarningIcon-foreground, #cca700);
      box-shadow: 0 0 6px var(--vscode-problemsWarningIcon-foreground, #cca700);
    }

    .severity-dot.healthy {
      background: var(--vscode-testing-iconPassed, #73c991);
    }

    .file-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .file-name {
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sparkline-container {
      width: 60px;
      height: 20px;
      flex-shrink: 0;
    }

    .sparkline {
      width: 100%;
      height: 100%;
    }

    .score-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      min-width: 36px;
      text-align: center;
      flex-shrink: 0;
    }

    .score-pill.critical {
      background: rgba(244, 71, 71, 0.2);
      color: var(--vscode-errorForeground, #f44747);
    }

    .score-pill.warning {
      background: rgba(204, 167, 0, 0.2);
      color: var(--vscode-problemsWarningIcon-foreground, #cca700);
    }

    .score-pill.healthy {
      background: rgba(115, 201, 145, 0.2);
      color: var(--vscode-testing-iconPassed, #73c991);
    }

    /* ========== DETAIL VIEW ========== */
    .detail-view {
      display: none;
      padding: 0;
    }

    .detail-view.visible {
      display: block;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .back-btn {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      font-size: 16px;
      transition: background 0.15s;
    }

    .back-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.1));
    }

    .detail-filename {
      font-weight: 600;
      font-size: 14px;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .detail-body {
      padding: 16px;
    }

    /* Metric Cards Grid */
    .metric-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }

    .metric-card {
      background: var(--vscode-input-background, rgba(255,255,255,0.05));
      border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }

    .metric-card .value {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.2;
    }

    .metric-card .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .metric-card.critical .value {
      color: var(--vscode-errorForeground, #f44747);
    }

    .metric-card.warning .value {
      color: var(--vscode-problemsWarningIcon-foreground, #cca700);
    }

    .metric-card.healthy .value {
      color: var(--vscode-testing-iconPassed, #73c991);
    }

    /* Section Headers */
    .section {
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
    }

    /* Sparkline in detail view */
    .detail-sparkline {
      width: 100%;
      height: 50px;
      margin-bottom: 16px;
    }

    /* Topic Tags */
    .topic-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .topic-tag {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      background: var(--vscode-badge-background, rgba(255,255,255,0.1));
      color: var(--vscode-badge-foreground, var(--vscode-foreground));
      white-space: nowrap;
    }

    .topic-tag.hot {
      background: rgba(244, 71, 71, 0.2);
      color: var(--vscode-errorForeground, #f44747);
      font-weight: 600;
    }

    /* Author Breakdown */
    .author-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .author-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .author-name {
      font-size: 12px;
      min-width: 80px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }

    .author-bar-container {
      flex: 1;
      height: 6px;
      background: var(--vscode-input-background, rgba(255,255,255,0.05));
      border-radius: 3px;
      overflow: hidden;
    }

    .author-bar {
      height: 100%;
      border-radius: 3px;
      background: var(--vscode-progressBar-background, #0078d4);
      transition: width 0.3s ease;
    }

    .author-pct {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      min-width: 32px;
      text-align: right;
    }

    /* Suggestion Box */
    .suggestion-box {
      background: var(--vscode-input-background, rgba(255,255,255,0.05));
      border-left: 3px solid var(--vscode-progressBar-background, #0078d4);
      border-radius: 0 6px 6px 0;
      padding: 12px;
      font-size: 12px;
      line-height: 1.6;
      color: var(--vscode-foreground);
    }

    .suggestion-box.critical {
      border-left-color: var(--vscode-errorForeground, #f44747);
    }

    .suggestion-box.warning {
      border-left-color: var(--vscode-problemsWarningIcon-foreground, #cca700);
    }

    /* Open file link */
    .open-file-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--vscode-textLink-foreground, #3794ff);
      font-size: 12px;
      cursor: pointer;
      margin-top: 12px;
      padding: 4px 0;
      border: none;
      background: none;
      text-decoration: underline;
    }

    .open-file-link:hover {
      color: var(--vscode-textLink-activeForeground, #3794ff);
    }

    /* ========== ANIMATIONS ========== */
    .fade-in {
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ========== SCROLLBAR STYLING ========== */
    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background, rgba(255,255,255,0.15));
      border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-hoverBackground, rgba(255,255,255,0.25));
    }
  </style>
</head>
<body>
  <!-- LIST VIEW -->
  <div id="listView">
    <div class="header">
      <span class="header-title">Highest Entropy Files</span>
      <div class="header-actions">
        <button class="icon-btn" id="refreshBtn" title="Refresh Analysis">⟳</button>
      </div>
    </div>

    <div id="loadingState" class="loading">
      <div class="spinner"></div>
      <span>Analyzing git history…</span>
    </div>

    <div id="emptyState" class="empty-state" style="display:none;">
      <div class="icon">🧪</div>
      <div class="title">No entropy data yet</div>
      <div class="subtitle">Click refresh to analyze your repository's git history.</div>
    </div>

    <ul id="fileList" class="file-list" style="display:none;"></ul>
  </div>

  <!-- DETAIL VIEW -->
  <div id="detailView" class="detail-view">
    <div class="detail-header">
      <button class="back-btn" id="backBtn" title="Back to list">←</button>
      <span class="detail-filename" id="detailFileName"></span>
    </div>
    <div class="detail-body" id="detailBody"></div>
  </div>

  <script>
    (function() {
      const vscode = acquireVsCodeApi();

      // DOM elements
      const listView = document.getElementById('listView');
      const detailView = document.getElementById('detailView');
      const loadingState = document.getElementById('loadingState');
      const emptyState = document.getElementById('emptyState');
      const fileList = document.getElementById('fileList');
      const detailFileName = document.getElementById('detailFileName');
      const detailBody = document.getElementById('detailBody');
      const backBtn = document.getElementById('backBtn');
      const refreshBtn = document.getElementById('refreshBtn');

      // Notify the extension that the webview is ready
      vscode.postMessage({ command: 'ready' });

      // Handle messages from the extension
      window.addEventListener('message', (event) => {
        const message = event.data;

        switch (message.command) {
          case 'updateFiles':
            renderFileList(message.files);
            break;
          case 'showDetail':
            renderDetailView(message.file);
            break;
        }
      });

      // Back button
      backBtn.addEventListener('click', () => {
        detailView.classList.remove('visible');
        listView.style.display = '';
      });

      // Refresh button
      refreshBtn.addEventListener('click', () => {
        loadingState.style.display = '';
        emptyState.style.display = 'none';
        fileList.style.display = 'none';
        vscode.postMessage({ command: 'refresh' });
      });

      /**
       * Renders the ranked file list.
       */
      function renderFileList(files) {
        loadingState.style.display = 'none';

        if (!files || files.length === 0) {
          emptyState.style.display = '';
          fileList.style.display = 'none';
          return;
        }

        emptyState.style.display = 'none';
        fileList.style.display = '';
        fileList.innerHTML = '';

        files.forEach((file, index) => {
          const li = document.createElement('li');
          li.className = 'file-item fade-in';
          li.style.animationDelay = (index * 0.03) + 's';

          const baseName = file.path.split('/').pop() || file.path;
          const dirPath = file.path.split('/').slice(0, -1).join('/');

          li.innerHTML = \`
            <span class="rank">\${index + 1}</span>
            <span class="severity-dot \${file.severity}"></span>
            <div class="file-info">
              <span class="file-name">\${escapeHtml(baseName)}</span>
              <span class="file-path">\${escapeHtml(dirPath)}</span>
            </div>
            <div class="sparkline-container">
              <svg class="sparkline" viewBox="0 0 60 20" preserveAspectRatio="none">
                \${renderSparklineSvg(file.history, file.severity)}
              </svg>
            </div>
            <span class="score-pill \${file.severity}">\${file.score}</span>
          \`;

          // Click to show detail
          li.addEventListener('click', () => {
            vscode.postMessage({ command: 'requestDetail', path: file.path });
          });

          // Double-click to open file
          li.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            vscode.postMessage({ command: 'openFile', path: file.path });
          });

          fileList.appendChild(li);
        });
      }

      /**
       * Generates SVG path data for a sparkline.
       */
      function renderSparklineSvg(history, severity) {
        if (!history || history.length < 2) {
          return '';
        }

        const max = Math.max(...history, 1);
        const min = Math.min(...history, 0);
        const range = max - min || 1;

        const points = history.map((val, i) => {
          const x = (i / (history.length - 1)) * 60;
          const y = 20 - ((val - min) / range) * 18 - 1;
          return \`\${x.toFixed(1)},\${y.toFixed(1)}\`;
        });

        const colorMap = {
          critical: 'var(--vscode-errorForeground, #f44747)',
          warning: 'var(--vscode-problemsWarningIcon-foreground, #cca700)',
          healthy: 'var(--vscode-testing-iconPassed, #73c991)',
        };

        const color = colorMap[severity] || colorMap.healthy;

        // Fill area
        const fillPoints = \`0,20 \${points.join(' ')} 60,20\`;

        return \`
          <polygon points="\${fillPoints}" fill="\${color}" fill-opacity="0.15"/>
          <polyline points="\${points.join(' ')}" fill="none" stroke="\${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        \`;
      }

      /**
       * Renders the detail view for a file.
       */
      function renderDetailView(file) {
        listView.style.display = 'none';
        detailView.classList.add('visible');

        const baseName = file.path.split('/').pop() || file.path;
        detailFileName.textContent = \`\${file.badge} \${baseName}\`;

        const authors = file.authors || [];
        const topics = file.topics || [];
        const history = file.history || [];

        // Compute author percentages
        const authorCounts = {};
        authors.forEach(a => {
          authorCounts[a] = (authorCounts[a] || 0) + 1;
        });
        // For display, we only have unique authors. Show equal distribution
        // unless we have actual commit-per-author data
        const authorEntries = authors.map((a, i) => ({
          name: a,
          pct: Math.round(100 / authors.length),
        }));

        detailBody.innerHTML = \`
          <div class="fade-in">
            <!-- Sparkline -->
            \${history.length >= 2 ? \`
              <div class="section">
                <div class="section-title">Score Trend (last \${history.length} weeks)</div>
                <svg class="detail-sparkline" viewBox="0 0 200 50" preserveAspectRatio="none">
                  \${renderDetailSparklineSvg(history, file.severity)}
                </svg>
              </div>
            \` : ''}

            <!-- Metric Cards -->
            <div class="metric-cards">
              <div class="metric-card \${file.severity}">
                <div class="value">\${file.score}</div>
                <div class="label">Entropy Score</div>
              </div>
              <div class="metric-card">
                <div class="value">\${file.editCount}</div>
                <div class="label">Total Edits</div>
              </div>
              <div class="metric-card">
                <div class="value">\${file.topicCount}</div>
                <div class="label">Distinct Topics</div>
              </div>
              <div class="metric-card">
                <div class="value">\${file.authorCount}</div>
                <div class="label">Authors</div>
              </div>
            </div>

            <!-- Topics -->
            \${topics.length > 0 ? \`
              <div class="section">
                <div class="section-title">Topics</div>
                <div class="topic-tags">
                  \${topics.map((t, i) => \`
                    <span class="topic-tag \${i < 3 ? 'hot' : ''}">\${escapeHtml(t)}</span>
                  \`).join('')}
                </div>
              </div>
            \` : ''}

            <!-- Authors -->
            \${authorEntries.length > 0 ? \`
              <div class="section">
                <div class="section-title">Authors</div>
                <div class="author-list">
                  \${authorEntries.map(a => \`
                    <div class="author-row">
                      <span class="author-name">\${escapeHtml(a.name)}</span>
                      <div class="author-bar-container">
                        <div class="author-bar" style="width: \${a.pct}%"></div>
                      </div>
                      <span class="author-pct">\${a.pct}%</span>
                    </div>
                  \`).join('')}
                </div>
              </div>
            \` : ''}

            <!-- Suggestion -->
            \${file.suggestion ? \`
              <div class="section">
                <div class="section-title">Recommendation</div>
                <div class="suggestion-box \${file.severity}">
                  \${escapeHtml(file.suggestion)}
                </div>
              </div>
            \` : ''}

            <!-- Open file link -->
            <button class="open-file-link" onclick="openFile('\${escapeAttr(file.path)}')">
              📄 Open \${escapeHtml(baseName)} in editor
            </button>
          </div>
        \`;
      }

      /**
       * Renders a larger sparkline for the detail view.
       */
      function renderDetailSparklineSvg(history, severity) {
        if (!history || history.length < 2) return '';

        const max = Math.max(...history, 1);
        const min = Math.min(...history, 0);
        const range = max - min || 1;

        const points = history.map((val, i) => {
          const x = (i / (history.length - 1)) * 200;
          const y = 50 - ((val - min) / range) * 44 - 3;
          return \`\${x.toFixed(1)},\${y.toFixed(1)}\`;
        });

        const colorMap = {
          critical: 'var(--vscode-errorForeground, #f44747)',
          warning: 'var(--vscode-problemsWarningIcon-foreground, #cca700)',
          healthy: 'var(--vscode-testing-iconPassed, #73c991)',
        };

        const color = colorMap[severity] || colorMap.healthy;
        const fillPoints = \`0,50 \${points.join(' ')} 200,50\`;

        // Add threshold lines
        const warningY = 50 - ((40 - min) / range) * 44 - 3;
        const criticalY = 50 - ((70 - min) / range) * 44 - 3;

        return \`
          <line x1="0" y1="\${warningY}" x2="200" y2="\${warningY}" stroke="var(--vscode-problemsWarningIcon-foreground, #cca700)" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4"/>
          <line x1="0" y1="\${criticalY}" x2="200" y2="\${criticalY}" stroke="var(--vscode-errorForeground, #f44747)" stroke-width="0.5" stroke-dasharray="4,4" opacity="0.4"/>
          <polygon points="\${fillPoints}" fill="\${color}" fill-opacity="0.1"/>
          <polyline points="\${points.join(' ')}" fill="none" stroke="\${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          \${points.map((p, i) => {
            if (i === points.length - 1) {
              return \`<circle cx="\${p.split(',')[0]}" cy="\${p.split(',')[1]}" r="3" fill="\${color}"/>\`;
            }
            return '';
          }).join('')}
        \`;
      }

      function openFile(path) {
        vscode.postMessage({ command: 'openFile', path });
      }

      function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
      }

      function escapeAttr(str) {
        return (str || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
      }

      // Expose openFile to inline onclick handlers
      window.openFile = openFile;
    })();
  </script>
</body>
</html>`;
    }
}
exports.EntropySidebarProvider = EntropySidebarProvider;
EntropySidebarProvider.viewType = 'entropyTracker.sidebar';
//# sourceMappingURL=sidebarProvider.js.map