@echo off
setlocal
echo ---------------------------------------------------------
echo [群益 API 元件一鍵註冊工具] - 請務必使用「系統管理員」執行
echo ---------------------------------------------------------

:: 您的自訂群益 API 元件路徑
set "skcom_dir=C:\caoapi\CapitalAPI_2.13.58\元件\x86"
set "skcom_path=%skcom_dir%\SKCOM.dll"

:: 檢查路徑是否存在
if not exist "%skcom_path%" (
    echo [!] 找不到路徑: "%skcom_path%"
    echo [?] 請確認您的這路徑是否輸入正確，包含中文名稱「元件」。
    pause
    exit /b
)

echo [+] 偵測到元件: "%skcom_path%"
echo [+] 正在使用 SysWOW64 版進行註冊...

:: 使用管理員權限進行註冊，SysWOW64 是處理 32-bit 元件的關鍵
%systemroot%\SysWOW64\regsvr32.exe /s "%skcom_path%"

if %errorlevel% neq 0 (
    echo [X] 註冊失敗！這通常是因為權限不足或是系統不支持。
) else (
    echo [V] 註冊成功！
    echo [!] 指令已發送，現在請重新啟動官方測試工具試試看！
)

pause
