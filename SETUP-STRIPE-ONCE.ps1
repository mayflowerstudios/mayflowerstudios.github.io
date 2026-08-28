$ErrorActionPreference = 'Stop'

# Catch unexpected runtime errors that happen outside the normal Fail() checks.
trap {
  Write-Host ''
  Write-Host 'UNEXPECTED SETUP ERROR' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($_.InvocationInfo -and $_.InvocationInfo.PositionMessage) {
    Write-Host $_.InvocationInfo.PositionMessage -ForegroundColor DarkGray
  }
  exit 1
}
$Host.UI.RawUI.WindowTitle = 'Mayflower Studios - One-Time Stripe Setup'

function Step($text) { Write-Host "`n== $text ==" -ForegroundColor Magenta }
function Good($text) { Write-Host "[OK] $text" -ForegroundColor Green }
function Warn($text) { Write-Host "! $text" -ForegroundColor Yellow }
function Fail($text) { Write-Host "`nERROR: $text" -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }
function SecureToText($secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function Resolve-FirebaseCli {
  # npm installs both firebase.ps1 and firebase.cmd on Windows. Calling the
  # PowerShell shim under strict error handling can turn Firebase's harmless
  # progress output into a terminating NativeCommandError. Prefer .cmd.
  $cmd = Get-Command firebase.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $app = Get-Command firebase -CommandType Application -ErrorAction SilentlyContinue
  if ($app) { return $app.Source }
  return $null
}
function Invoke-FirebaseSafe {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
  $oldPreference = $ErrorActionPreference
  try {
    # Firebase CLI sometimes writes progress/warnings to stderr even when the
    # command succeeds. Let the CLI finish, then trust its numeric exit code.
    $ErrorActionPreference = 'Continue'
    & $script:FirebaseCli @Arguments 2>&1 | Out-Host
    $code = $LASTEXITCODE
    return $code
  } finally {
    $ErrorActionPreference = $oldPreference
  }
}
function Test-FirebaseSession {
  # login:list is a local credential check. We already know the exact project
  # from .firebaserc, so there is no reason to call projects:list here.
  $oldPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $loginJson = (& $script:FirebaseCli login:list --json 2>$null | Out-String)
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oldPreference
  }
  if ($code -ne 0 -or [string]::IsNullOrWhiteSpace($loginJson)) { return $false }
  try {
    $parsed = $loginJson | ConvertFrom-Json
    if ($parsed.status -eq 'success' -and $parsed.result -and @($parsed.result).Count -gt 0) { return $true }
  } catch {
    # Fallback for CLI format differences: a successful JSON response that
    # visibly contains an account email still means a login is saved.
    if ($loginJson -match '@') { return $true }
  }
  return $false
}
function SaveSecret($name, $value) {
  $tmp = Join-Path $env:TEMP ("mayflower-" + [guid]::NewGuid().ToString('N') + '.txt')
  try {
    [IO.File]::WriteAllText($tmp, $value, [Text.UTF8Encoding]::new($false))
    $code = Invoke-FirebaseSafe functions:secrets:set $name --data-file $tmp --project $script:ProjectId
    if ($code -ne 0) { throw "Firebase could not save $name." }
  } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
}

Set-Location $PSScriptRoot
Write-Host ''
Write-Host 'Mayflower Studios - Stripe World Store Setup' -ForegroundColor Cyan
Write-Host 'Run this ONCE. After this, adding a paid world is just: upload it, type the price, Publish.' -ForegroundColor White

if (!(Test-Path '.firebaserc')) { Fail 'This setup file must stay inside the Mayflower website folder.' }
try { $script:ProjectId = (Get-Content '.firebaserc' -Raw | ConvertFrom-Json).projects.default } catch { Fail 'Could not read the Firebase project from .firebaserc.' }
if (!$script:ProjectId) { Fail 'No default Firebase project is configured.' }
Good "Firebase project: $script:ProjectId"

Step 'Checking Node.js'
if (!(Get-Command node -ErrorAction SilentlyContinue) -or !(Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required once to deploy the payment backend.' -ForegroundColor Yellow
  Write-Host 'Install the LTS version from https://nodejs.org/ then run this file again.'
  Start-Process 'https://nodejs.org/'
  Read-Host 'Press Enter to close'
  exit 1
}
Good "Node.js $(node --version)"

Step 'Checking Firebase tools'
$firebaseInstalled = Resolve-FirebaseCli
if (!$firebaseInstalled) {
  Write-Host 'Installing the latest Firebase CLI...' -ForegroundColor Gray
  & npm install -g firebase-tools@latest
  if ($LASTEXITCODE -ne 0) { Fail 'Firebase CLI installation failed.' }
} else {
  $script:FirebaseCli = Resolve-FirebaseCli
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $firebaseVersionText = (& $script:FirebaseCli --version 2>$null | Out-String).Trim()
  $ErrorActionPreference = $oldPreference
  $needsFirebaseUpdate = $false
  try {
    $firebaseVersion = [version]($firebaseVersionText -replace '[^0-9.].*$','')
    if ($firebaseVersion -lt [version]'15.22.3') { $needsFirebaseUpdate = $true }
  } catch {
    $needsFirebaseUpdate = $true
  }

  # Firebase CLI 15.21.x had a Windows/Node 24 login crash after OAuth succeeded.
  # Update older/unknown installs before touching authentication.
  if ($needsFirebaseUpdate) {
    Write-Host "Updating Firebase CLI ($firebaseVersionText -> latest) to avoid the Windows login crash..." -ForegroundColor Gray
    & npm install -g firebase-tools@latest
    if ($LASTEXITCODE -ne 0) { Fail 'Firebase CLI update failed.' }
  }
}
$script:FirebaseCli = Resolve-FirebaseCli
if (!$script:FirebaseCli) { Fail 'Firebase CLI was installed, but Windows could not find firebase.cmd.' }
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$firebaseVersionText = (& $script:FirebaseCli --version 2>$null | Out-String).Trim()
$ErrorActionPreference = $oldPreference
Good "Firebase CLI $firebaseVersionText is ready."
Write-Host "[OK] Using Firebase command: $script:FirebaseCli" -ForegroundColor DarkGreen

Step 'Connecting to Firebase'
$authOkay = $false

# First check whether the previous browser login already saved a valid session.
# This avoids forcing another OAuth login when Firebase printed Success but exited badly.
Write-Host 'Checking the saved Firebase login...' -ForegroundColor Gray
if (Test-FirebaseSession) {
  $authOkay = $true
  Good 'Your existing Firebase login is valid.'
}

if (!$authOkay) {
  Write-Host 'Firebase needs you to sign in once. A browser window/link will open.' -ForegroundColor Gray
  $loginExit = Invoke-FirebaseSafe login --reauth

  if ($loginExit -ne 0) {
    Warn 'Firebase returned an error after the browser login. Checking whether authentication was actually saved...'
  }

  if (Test-FirebaseSession) {
    $authOkay = $true
    if ($loginExit -ne 0) {
      Good 'Authentication succeeded despite the Firebase CLI exit error. Continuing safely.'
    } else {
      Good 'Firebase sign-in succeeded.'
    }
  }
}

if (!$authOkay) {
  Fail 'Firebase authentication is still unavailable. The setup cannot safely continue.'
}
Good "Firebase is connected to project $script:ProjectId."

Step 'Stripe key'
Write-Host 'Open Stripe Dashboard -> Developers -> API keys.' -ForegroundColor White
Write-Host 'For testing, reveal and copy the TEST secret key (starts with sk_test_).' -ForegroundColor Gray
$secure = Read-Host 'Paste your Stripe secret key' -AsSecureString
$stripeKey = SecureToText $secure
if ($stripeKey -notmatch '^sk_(test|live)_[A-Za-z0-9_]+$') { Fail 'That does not look like a Stripe secret key (sk_test_... or sk_live_...).' }
SaveSecret 'STRIPE_SECRET_KEY' $stripeKey
Good 'Stripe key stored privately in Firebase Secret Manager.'

# Create the Stripe webhook BEFORE Firebase Functions are deployed.
# Firebase requires every declared function secret to exist during deployment.
# Stripe can register an HTTPS endpoint before that endpoint is live, so doing
# this first avoids Firebase stopping to ask the user for STRIPE_WEBHOOK_SECRET.
Step 'Connecting Stripe purchase confirmation'
$webhookUrl = "https://us-central1-$script:ProjectId.cloudfunctions.net/worldStripeWebhook"
$pair = [Text.Encoding]::ASCII.GetBytes("$stripeKey`:")
$headers = @{ Authorization = 'Basic ' + [Convert]::ToBase64String($pair) }
try {
  Write-Host 'Creating the Stripe webhook and storing its signing secret automatically...' -ForegroundColor Gray
  $existing = Invoke-RestMethod -Method Get -Uri 'https://api.stripe.com/v1/webhook_endpoints?limit=100' -Headers $headers
  foreach ($ep in @($existing.data)) {
    if ($ep.url -eq $webhookUrl) {
      Write-Host 'Replacing the previous Mayflower webhook so its signing secret can be stored safely...' -ForegroundColor DarkGray
      Invoke-RestMethod -Method Delete -Uri ("https://api.stripe.com/v1/webhook_endpoints/" + $ep.id) -Headers $headers | Out-Null
    }
  }
  $body = @{
    'url' = $webhookUrl
    'enabled_events[0]' = 'checkout.session.completed'
    'enabled_events[1]' = 'checkout.session.async_payment_succeeded'
    'enabled_events[2]' = 'charge.refunded'
    'enabled_events[3]' = 'charge.dispute.created'
    'enabled_events[4]' = 'charge.dispute.closed'
    'description' = 'Mayflower Studios paid 3DX worlds'
  }
  $endpoint = Invoke-RestMethod -Method Post -Uri 'https://api.stripe.com/v1/webhook_endpoints' -Headers $headers -Body $body -ContentType 'application/x-www-form-urlencoded'
  if (!$endpoint.secret -or $endpoint.secret -notmatch '^whsec_') { throw 'Stripe did not return a webhook signing secret.' }
  SaveSecret 'STRIPE_WEBHOOK_SECRET' $endpoint.secret
  Good 'Stripe webhook is registered and its signing secret is stored privately.'
} catch {
  Fail ("Could not create the Stripe webhook automatically: " + $_.Exception.Message)
}

Step 'Installing the tiny payment backend'
Push-Location 'functions'
try {
  & npm install --omit=dev
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
} finally { Pop-Location }
Good 'Backend dependencies installed.'

# Firebase normally gives function discovery only 10 seconds. On some Windows
# machines (especially with antivirus/npm module scanning) the local discovery
# server can take longer even when the code is fine. Firebase officially supports
# increasing this value. Keep it local to this setup process.
$env:FUNCTIONS_DISCOVERY_TIMEOUT = '60'
Good 'Firebase function-discovery timeout raised to 60 seconds for this setup.'

Step 'Publishing your Firebase security rules'
$code = Invoke-FirebaseSafe deploy --only "database,storage" --project $script:ProjectId
if ($code -ne 0) { Fail 'Database/Storage rules deployment failed. Do not publish paid worlds until this succeeds.' }
Good 'Database and Storage protections are live.'

Step 'Deploying Stripe world store'
$code = Invoke-FirebaseSafe deploy --only "functions:worldCheckout,functions:worldDownload,functions:worldStripeWebhook" --project $script:ProjectId
if ($code -ne 0) {
  Warn 'Firebase Functions deployment failed.'
  Write-Host 'This is not automatically a billing problem. The full Firebase error is shown above.'
  Write-Host 'The setup already uses a 60-second discovery timeout and Node.js 22.' -ForegroundColor Gray
  Read-Host 'Press Enter to close'
  exit 1
}
Good 'Checkout, purchase confirmation, and protected downloads are deployed.'

Step 'Protected download design'
Good 'Paid worlds use browser encryption + account-verified decryption. No Eventarc or signed-URL IAM setup is required.'

Step 'Finished'
Write-Host 'Stripe is connected to the World Library.' -ForegroundColor Green
Write-Host ''
Write-Host 'From now on:' -ForegroundColor White
Write-Host '  Admin -> 3DX World Library -> New world'
Write-Host '  1. Upload .world file'
Write-Host '  2. Add pictures + description'
Write-Host '  3. Choose Paid'
Write-Host '  4. Type the price'
Write-Host '  5. Publish'
Write-Host ''
Write-Host 'You do NOT create Stripe products, prices, links, or webhooks for each world.' -ForegroundColor Cyan
Write-Host "Purchases attach to the buyer's Mayflower account and remain available for redownload." -ForegroundColor Cyan
Write-Host ''
Write-Host 'Use Stripe TEST mode first. A standard successful Stripe test card is 4242 4242 4242 4242.' -ForegroundColor Gray
Read-Host 'Press Enter to close'
