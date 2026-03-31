"""
群益 (Capital Securities) API WebSocket 橋接服務
此腳本作為 React 儀表板與 群益 SKCOM 之間的橋接器。
需求:
1. Windows 系統
2. 已安裝 群益策略王
3. pip install fastapi uvicorn pywin32
"""

import asyncio
import json
import pythoncom
import win32com.client
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import threading

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全域連線清單，供 COM 事件與 WebSocket 共享
CLIENTS = set()
MAIN_LOOP = None

# ── 群益事件處理器 ──────────────────────────────────────────────────────────
# 注意: win32com.client.DispatchWithEvents 要求這必須是一個 class 名稱
class SKQuoteEvents:
    def OnConnection(self, nKind, nCode):
        print(f"[SK] 連線狀態: {nKind}, 代碼: {nCode}")
        # 通知前端連線成功 (也可以在此廣播其狀態)

    def OnNotifyTicks(self, nStockIdx, nPtr, nDate, nTime, nClose, nQty):
        # 當成交明細更新時觸發
        # nClose 是成交價 * 100, nTime 是 HHMMSS 格式
        tick = {
            "type": "tick",
            "time": f"{nTime:06}", # HHMMSS
            "price": nClose / 100.0,
            "volume": nQty,
            "isLarge": nQty >= 50
        }
        self.broadcast(tick)

    def broadcast(self, data):
        if MAIN_LOOP and CLIENTS:
            for client in CLIENTS:
                asyncio.run_coroutine_threadsafe(client.send_json(data), MAIN_LOOP)

# ── API 控制類別 ────────────────────────────────────────────────────────────
class CapitalBridge:
    def __init__(self):
        self.sk_center = None
        self.sk_quote = None
        self.is_logged_in = False

    def login(self, user_id, password, cert_path=None):
        try:
            # 在執行緒中必須初始化 COM
            pythoncom.CoInitialize()
            if not self.sk_center:
                self.sk_center = win32com.client.Dispatch("SKCenterLib.SKCenterLib")
            
            # 設定憑證路徑 (如果提供)
            if cert_path:
                print(f"[SK] 設定憑證路徑: {cert_path}")
                res_cert = self.sk_center.SKCenterLib_SetCertPath(cert_path)
                if res_cert != 0:
                    print(f"[SK] 憑證路徑設定失敗: {res_cert}")

            # 執行登入
            res = self.sk_center.SKCenterLib_Login(user_id, password)
            if res == 0:
                print(f"[SK] 登入成功 ({user_id})")
                self.is_logged_in = True
                if not self.sk_quote:
                    self.sk_quote = win32com.client.DispatchWithEvents("SKQuoteLib.SKQuoteLib", SKQuoteEvents)
                # 進入報價監控模式
                self.sk_quote.SKQuoteLib_EnterMonitor()
                return 0, "成功"
            else:
                print(f"[SK] 登入失敗: {res}")
                self.is_logged_in = False
                return res, f"登入失敗: {res}"
        except Exception as e:
            err_msg = str(e)
            print(f"[SK] 初始化錯誤: {err_msg}")
            self.is_logged_in = False
            return -1, f"初始化錯誤: {err_msg}"

    def subscribe(self, symbol):
        # 訂閱操作需要在 COM 初始化過的執行緒執行，或者確保 sk_quote 可用
        if self.is_logged_in and self.sk_quote:
            try:
                res = self.sk_quote.SKQuoteLib_RequestTicks(0, symbol)
                print(f"[SK] 訂閱 {symbol}: 回傳碼 {res}")
            except Exception as e:
                print(f"[SK] 訂閱錯誤: {e}")

bridge = CapitalBridge()

async def async_login_task(websocket, user_id, password, cert_path):
    # 使用 run_in_executor 執行同步的 COM 運作
    loop = asyncio.get_event_loop()
    res_code, msg_text = await loop.run_in_executor(None, bridge.login, user_id, password, cert_path)
    await websocket.send_json({
        "type": "login_result", 
        "success": bridge.is_logged_in,
        "code": res_code,
        "message": msg_text
    })

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global MAIN_LOOP
    await websocket.accept()
    MAIN_LOOP = asyncio.get_event_loop()
    CLIENTS.add(websocket)
    print(f"[WS] Client connected (Port 8010). Total: {len(CLIENTS)}")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"[WS] Rcv: {data}")
            try:
                msg = json.loads(data)
                m_type = msg.get("type")
                
                if m_type == "login":
                    user_id = msg.get("userId")
                    password = msg.get("password")
                    cert_path = msg.get("certPath")
                    print(f"[Bridge] 登入請求: {user_id}, 憑證: {cert_path}")
                    asyncio.create_task(async_login_task(websocket, user_id, password, cert_path))
                
                elif m_type == "subscribe":
                    bridge.subscribe(msg.get("symbol"))
            except Exception as e:
                print(f"[WS] JSON Parse Error: {e}")
                
    except Exception as e:
        print(f"[WS] WebSocket Error: {e}")
    finally:
        CLIENTS.remove(websocket)
        print(f"[WS] Client disconnected.")

if __name__ == "__main__":
    # 強制使用 127.0.0.1 避免 IPv4/v6 主機名解析問題，並改用 8010 避免衝突
    uvicorn.run(app, host="127.0.0.1", port=8010)
