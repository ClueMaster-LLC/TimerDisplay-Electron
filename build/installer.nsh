RequestExecutionLevel admin
!macro customInstall
  DeleteRegValue HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "ClueMaster-Timer"
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "ClueMaster-Timer"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "ClueMaster-Timer" "$INSTDIR\${PRODUCT_FILENAME}.exe"
!macroend

!macro customUnInstall
  DeleteRegValue HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "ClueMaster-Timer"
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "ClueMaster-Timer"
!macroend
