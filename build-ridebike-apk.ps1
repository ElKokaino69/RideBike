# RideBike - APK bauen (Windows 11, PowerShell)
# (c) 2026 Florian Enders
#
# Aufruf im Projektordner:
#   powershell -ExecutionPolicy Bypass -File .\build-ridebike-apk.ps1
# Optional Release statt Debug:
#   powershell -ExecutionPolicy Bypass -File .\build-ridebike-apk.ps1 -Release

param([switch]$Release)
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Green }

# --- Java: Capacitor 8 braucht JDK 21. Android Studio bringt eins mit (jbr). ---
$jbrCandidates = @(
  "$env:ProgramFiles\Android\Android Studio\jbr",
  "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
  "${env:ProgramFiles(x86)}\Android\Android Studio\jbr"
)
$jbr = $jbrCandidates | Where-Object { Test-Path "$_\bin\java.exe" } | Select-Object -First 1
if ($jbr) {
  $env:JAVA_HOME = $jbr
  $env:Path = "$jbr\bin;$env:Path"
  Write-Host "JAVA_HOME = $jbr"
} else {
  Write-Warning "Android-Studio-JDK nicht gefunden. Bitte JAVA_HOME auf ein JDK 21 setzen (Java 26 wird von Gradle evtl. nicht unterstuetzt)."
}

# --- Android SDK ---
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path $env:ANDROID_HOME)) { throw "Android SDK nicht gefunden unter $env:ANDROID_HOME" }
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
Write-Host "ANDROID_HOME = $env:ANDROID_HOME"

Step "Abhaengigkeiten installieren"
npm install
if ($LASTEXITCODE) { throw "npm install fehlgeschlagen" }

Step "Web-App bauen (Vite -> www)"
npm run build
if ($LASTEXITCODE) { throw "Build fehlgeschlagen" }

if (-not (Test-Path ".\android")) {
  Step "Android-Plattform anlegen"
  npx cap add android
  if ($LASTEXITCODE) { throw "cap add android fehlgeschlagen" }
}

Step "Manifest (Standort, Sprachausgabe) anpassen"
node scripts/android-setup.mjs

Step "App-Icon und Splash erzeugen"
npx capacitor-assets generate --android --iconBackgroundColor '#070b10' --splashBackgroundColor '#070b10'

Step "Capacitor synchronisieren"
npx cap sync android
if ($LASTEXITCODE) { throw "cap sync fehlgeschlagen" }

Step "Gradle-Build"
Push-Location android
try {
  if ($Release) { .\gradlew.bat assembleRelease } else { .\gradlew.bat assembleDebug }
  if ($LASTEXITCODE) { throw "Gradle-Build fehlgeschlagen" }
} finally { Pop-Location }

$variant = if ($Release) { 'release' } else { 'debug' }
$apk = Get-ChildItem ".\android\app\build\outputs\apk\$variant\*.apk" | Select-Object -First 1
if ($apk) {
  $target = ".\RideBike-$variant.apk"
  Copy-Item $apk.FullName $target -Force
  Write-Host "`nFertig: $((Resolve-Path $target).Path)" -ForegroundColor Cyan
  Write-Host "Installieren per USB:  adb install -r $target"
} else {
  Write-Warning "Keine APK gefunden."
}
