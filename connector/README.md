# DistroSync Tally Connector

High-performance, secure on-premise connector bridging **TallyPrime / Tally.ERP 9** to the **DistroSync Cloud Application**.

## Key Features

- **Standalone Windows Executable**: Bundled with the Node.js runtime. Customers do **not** need Node.js, npm, or Python installed.
- **Outbound Persistent WebSocket**: Traverses corporate firewalls and NAT without router port forwarding.
- **1-Click Browser Pairing**: Automatically opens `http://localhost:9123` on first launch to enter the pairing code generated from the DistroSync web dashboard.
- **Real-time TallyPrime XML Bridge**: Queries stock items, inventory levels, customer ledgers, and voucher creation via Tally's local HTTP XML server on port 9000.
- **Auto-Reconnect & Health Heartbeat**: Recovers gracefully from network interruptions with exponential backoff.
- **Local Persistence**: Stores authentication tokens securely in `%APPDATA%/DistroSync/config.json`.

---

## Directory Structure

```text
connector/
├── package.json               # Dependencies & packaging config
├── build.js                   # Bundler (esbuild) + binary packager (pkg)
├── install-windows.bat        # 1-click Windows runner/helper
├── dist/                      # Output directory for compiled .exe
│   └── tally-connector.exe
└── src/
    ├── index.js               # Main process entrypoint
    ├── config/
    │   └── config.js          # Configuration loader
    ├── storage/
    │   └── storage.service.js # %APPDATA%/DistroSync manager
    ├── auth/
    │   └── auth.service.js    # Code pairing & token exchange
    ├── connection/
    │   └── connection.manager.js # Outbound WebSocket manager
    ├── tally/
    │   ├── tally.client.js    # Local HTTP XML client (port 9000)
    │   └── tally.templates.js # TDL XML templates
    ├── jobs/
    │   └── job.processor.js   # Dispatched sync job executor
    ├── ui/
    │   ├── local.server.js    # Local Express dashboard (port 9123)
    │   └── public/
    │       └── index.html     # Setup & pairing UI
    └── utils/
        └── logger.js          # Rotating file & console logger
```

---

## Developer Workflow

### 1. Install Dependencies
```bash
cd connector
npm install
```

### 2. Run Locally in Development Mode
```bash
npm start
```
By default, the local dashboard will open on `http://localhost:9123`.

### 3. Build Standalone Windows Executable
```bash
npm run build:exe
```
This produces:
`connector/dist/tally-connector.exe`

---

## User Installation & Setup Flow

1. **In DistroSync Web App**:
   - User goes to **Settings -> ERP Integration -> Tally**.
   - Clicks **"Connect Tally"**.
   - Receives a 6-digit code (e.g. `DS-9A3F12`) and clicks **"Download Tally Connector (.exe)"**.

2. **Run Executable**:
   - User double-clicks `tally-connector.exe`.
   - Browser opens to `http://localhost:9123`.
   - User pastes `DS-9A3F12` and clicks **"Pair Connector"**.

3. **Connected!**:
   - Connector exchanges code with DistroSync backend for a persistent secret.
   - Outbound WebSocket connects to `/ws/connector`.
   - Connector detects active company in TallyPrime on port 9000.
   - Cloud dashboard switches status to **Connected (Online)**.
