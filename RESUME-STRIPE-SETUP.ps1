$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Mayflower Studios - Resume Stripe Setup'

function Pause-And-Exit([int]$Code = 0) {
  Write-Host ''
  if ($Code -eq 0) { Write-Host 'Finished. Press Enter to close.' -ForegroundColor Green }
  else { Write-Host "Setup stopped with error code $Code. Press Enter to close." -ForegroundColor Red }
  [void](Read-Host)
  exit $Code
}

try {
  Set-Location $PSScriptRoot
  $projectId = 'watchtogether-95d7d'

  Write-Host ''
  Write-Host 'Mayflower Studios - Resume Stripe World Store Setup' -ForegroundColor Cyan
  Write-Host 'This version removes the Eventarc/Storage trigger that caused the IAM error.' -ForegroundColor Gray
  Write-Host 'Your Stripe key and webhook secret do NOT need to be entered again.' -ForegroundColor Gray
  Write-Host ''

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found.' }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found.' }
  $firebaseCmd = (Get-Command firebase.cmd -ErrorAction SilentlyContinue)
  if (-not $firebaseCmd) { throw 'firebase.cmd was not found. Install/update Firebase CLI first with: npm install -g firebase-tools' }

  Write-Host '[1/3] Installing/updating payment backend dependencies...' -ForegroundColor Magenta
  Push-Location (Join-Path $PSScriptRoot 'functions')
  try {
    & npm install --omit=dev
    if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE." }
  } finally { Pop-Location }
  Write-Host '[OK] Dependencies are ready.' -ForegroundColor Green

  Write-Host ''
  Write-Host '[2/3] Publishing the updated paid-world security rules...' -ForegroundColor Magenta
  & $firebaseCmd.Source deploy --only 'database,storage' --project $projectId
  $rulesCode = $LASTEXITCODE
  if ($rulesCode -ne 0) { throw "Database/Storage rules deployment failed with exit code $rulesCode." }
  Write-Host '[OK] Updated encrypted-world rules are live.' -ForegroundColor Green

  $env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
  Write-Host ''
  Write-Host '[3/3] Deploying the three Stripe HTTPS functions...' -ForegroundColor Magenta
  Write-Host 'No Storage event trigger. No Eventarc. No Pub/Sub IAM role setup.' -ForegroundColor Gray
  & $firebaseCmd.Source deploy --only 'functions:worldCheckout,functions:worldDownload,functions:worldStripeWebhook' --project $projectId
  $deployCode = $LASTEXITCODE
  if ($deployCode -ne 0) { throw "Firebase Functions deployment failed with exit code $deployCode." }

  Write-Host ''
  Write-Host '[OK] Stripe checkout, purchase confirmation, and account-linked downloads are deployed.' -ForegroundColor Green
  Write-Host 'Paid .world files are encrypted in your Admin browser before upload.' -ForegroundColor Gray
  Write-Host 'The decryption key stays private and is returned only after purchase/account verification.' -ForegroundColor Gray
  Write-Host ''
  Write-Host 'You can now use the site normally:' -ForegroundColor Cyan
  Write-Host 'Admin -> 3DX World Library -> upload world -> choose Paid -> enter price -> Publish.' -ForegroundColor White
  Pause-And-Exit 0
}
catch {
  Write-Host ''
  Write-Host 'SETUP ERROR' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host ''
  Write-Host 'The full error should be visible above. Send me a screenshot if needed.' -ForegroundColor Yellow
  Pause-And-Exit 1
}
