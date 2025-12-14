!macro customInstall
  ; Add to startup registry (will appear in Windows Startup settings)
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${PRODUCT_NAME}" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  
  ; For DEV builds, set as disabled by default in Windows Startup
  ; Check if this is the DEV build by comparing product name
  StrCmp "${PRODUCT_NAME}" "ClueMaster-Timer-Display-DEV" 0 +2
    ; DEV build - write disabled state (disabled by default in Windows Startup)
    WriteRegBin HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run" "${PRODUCT_NAME}" 0300000066AF9C8A2E3FDA01
!macroend

!macro customUnInstall
  ; Remove the current product name entry
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${PRODUCT_NAME}"
!macroend
