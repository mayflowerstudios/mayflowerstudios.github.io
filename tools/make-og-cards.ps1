# tools/make-og-cards.ps1
# Generates the social-preview (Open Graph) card images in assets/og/.
# Each card: aurora-dark background, big artwork or emoji panel on the right,
# title + subtitle on the left, site pill bottom-left.
#
# To add a page: add a row to $pages below, then run:  pwsh tools/make-og-cards.ps1

Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase

$repo = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $repo "assets\og"
New-Item -ItemType Directory -Force $outDir | Out-Null

# ---- palette (matches style.css) ----
$COL = @{
  bg1     = "#0B1120"; bg2 = "#161B33"
  rose    = "#F9A8D4"; violet = "#C4B5FD"; emerald = "#6EE7B7"; gold = "#F5C66A"
  text    = "#F3F4F8"; sub = "#B6BDD3"; dim = "#8B92A8"
}

function C([string]$hex, [byte]$alpha = 255) {
  $c = [Windows.Media.ColorConverter]::ConvertFromString($hex)
  [Windows.Media.Color]::FromArgb($alpha, $c.R, $c.G, $c.B)
}
function SB([string]$hex, [byte]$alpha = 255) {
  $b = New-Object Windows.Media.SolidColorBrush (C $hex $alpha); $b.Freeze(); $b
}
function MakeText([string]$text, [string]$family, $weight, [double]$size, $brush, [double]$maxWidth = 0) {
  $ff = [Windows.Media.FontFamily]::new($family)
  $tf = [Windows.Media.Typeface]::new($ff, [Windows.FontStyles]::Normal, $weight, [Windows.FontStretches]::Normal)
  $ft = [Windows.Media.FormattedText]::new($text,
        [Globalization.CultureInfo]::InvariantCulture,
        [Windows.FlowDirection]::LeftToRight, $tf, $size, $brush, 1.0)
  if ($maxWidth -gt 0) { $ft.MaxTextWidth = $maxWidth }
  $ft
}

function New-OgCard {
  param($file, $kicker, $title, $sub, $accent, $art, $emoji, [double]$titleSize = 64)

  $W = 1200.0; $H = 630.0
  $dv = New-Object Windows.Media.DrawingVisual
  $dc = $dv.RenderOpen()

  # background gradient
  $bg = New-Object Windows.Media.LinearGradientBrush (C $COL.bg1), (C $COL.bg2), 32.0
  $dc.DrawRectangle($bg, $null, (New-Object Windows.Rect 0, 0, $W, $H))

  # aurora glows
  function Glow([double]$cx, [double]$cy, [double]$rx, [double]$ry, $color) {
    $rb = New-Object Windows.Media.RadialGradientBrush
    $rb.GradientOrigin = New-Object Windows.Point 0.5, 0.5
    $rb.Center = $rb.GradientOrigin
    $rb.RadiusX = 0.5; $rb.RadiusY = 0.5
    $rb.GradientStops.Add((New-Object Windows.Media.GradientStop $color, 0.0))
    $rb.GradientStops.Add((New-Object Windows.Media.GradientStop (C "#000000" 0), 1.0))
    $rb.Freeze()
    $dc.DrawEllipse($rb, $null, (New-Object Windows.Point $cx, $cy), $rx, $ry)
  }
  Glow 180 90  480 320 (C $COL.rose 46)
  Glow 1050 560 500 340 (C $COL.violet 44)
  Glow 700 40  380 260 (C $COL.emerald 26)
  Glow 940 300 420 320 (C $accent 30)

  # scattered stars (seeded so cards are stable between runs)
  $rnd = New-Object System.Random 20260722
  for ($i = 0; $i -lt 46; $i++) {
    $x = $rnd.NextDouble() * $W; $y = $rnd.NextDouble() * $H
    $r = 0.8 + $rnd.NextDouble() * 1.4
    $a = 28 + $rnd.Next(80)
    $dc.DrawEllipse((SB "#FFFFFF" ([byte]$a)), $null, (New-Object Windows.Point $x, $y), $r, $r)
  }

  # ---- right art panel ----
  $panel = New-Object Windows.Rect 770, 115, 340, 400
  $panelGeo = New-Object Windows.Media.RectangleGeometry $panel, 30, 30
  $panelPen = New-Object Windows.Media.Pen (SB "#FFFFFF" 34), 1.6
  $dc.DrawRoundedRectangle((SB "#FFFFFF" 12), $panelPen, $panel, 30, 30)

  if ($art) {
    $img = New-Object Windows.Media.Imaging.BitmapImage
    $img.BeginInit(); $img.UriSource = New-Object Uri $art; $img.CacheOption = "OnLoad"; $img.EndInit()
    # fit inside panel with padding, keep aspect
    $pad = 26.0
    $availW = $panel.Width - 2 * $pad; $availH = $panel.Height - 2 * $pad
    $scale = [Math]::Min($availW / $img.PixelWidth, $availH / $img.PixelHeight)
    $dw = $img.PixelWidth * $scale; $dh = $img.PixelHeight * $scale
    $dx = $panel.X + ($panel.Width - $dw) / 2; $dy = $panel.Y + ($panel.Height - $dh) / 2
    $dc.PushClip($panelGeo)
    $dc.DrawImage($img, (New-Object Windows.Rect $dx, $dy, $dw, $dh))
    $dc.Pop()
  }
  elseif ($emoji) {
    $ft = MakeText $emoji "Segoe UI Emoji" ([Windows.FontWeights]::Normal) 185 (SB $COL.text)
    $ex = $panel.X + ($panel.Width - $ft.Width) / 2
    $ey = $panel.Y + ($panel.Height - $ft.Height) / 2
    $dc.DrawText($ft, (New-Object Windows.Point $ex, $ey))
  }

  # ---- left text ----
  $left = 78.0; $maxW = 640.0

  $kick = MakeText $kicker.ToUpper() "Segoe UI" ([Windows.FontWeights]::SemiBold) 23 (SB $accent) $maxW
  $dc.DrawText($kick, (New-Object Windows.Point $left, 130))

  $tt = MakeText $title "Segoe UI" ([Windows.FontWeights]::Bold) $titleSize (SB $COL.text) $maxW
  $dc.DrawText($tt, (New-Object Windows.Point $left, 168))

  $accentBar = New-Object Windows.Rect $left, (188 + $tt.Height), 76, 5
  $dc.DrawRoundedRectangle((SB $accent 220), $null, $accentBar, 2.5, 2.5)

  $ss = MakeText $sub "Segoe UI" ([Windows.FontWeights]::Normal) 27 (SB $COL.sub) $maxW
  $dc.DrawText($ss, (New-Object Windows.Point $left, (212 + $tt.Height)))

  # ---- bottom pill ----
  $pillText = MakeText "mayflowerstudios.net" "Segoe UI" ([Windows.FontWeights]::SemiBold) 21 (SB $COL.text 225)
  $pw = $pillText.Width + 58; $ph = 44.0; $py = $H - 84
  $pillRect = New-Object Windows.Rect $left, $py, $pw, $ph
  $dc.DrawRoundedRectangle((SB "#FFFFFF" 16), (New-Object Windows.Media.Pen (SB "#FFFFFF" 36), 1.2), $pillRect, 22, 22)
  $dc.DrawEllipse((SB $accent), $null, (New-Object Windows.Point ($left + 22), ($py + $ph / 2)), 5, 5)
  $dc.DrawText($pillText, (New-Object Windows.Point ($left + 38), ($py + ($ph - $pillText.Height) / 2)))

  $dc.Close()

  $rtb = New-Object Windows.Media.Imaging.RenderTargetBitmap 1200, 630, 96, 96, ([Windows.Media.PixelFormats]::Pbgra32)
  $rtb.Render($dv)
  $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
  $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($rtb))
  $fs = [IO.File]::Create((Join-Path $outDir $file))
  $enc.Save($fs); $fs.Close()
  Write-Host "made $file"
}

$icons = Join-Path $repo "assets\icons"

$pages = @(
  @{ file="home.png";            kicker="A tiny indie studio";  title="Mayflower Studios";    sub="Cozy things made to be shared — watch parties, games for two, stories, a radio, and an idle RPG."; accent=$COL.rose;    art="$icons\favicon.png" }
  @{ file="radio.png";           kicker="Free Windows app";     title="Mayflower Radio";      sub="Your own internet radio station — YouTube and Spotify links in, one shareable URL out.";           accent=$COL.gold;    art="$repo\radio\logo.png" }
  @{ file="projects.png";        kicker="Projects";             title="Apps, mods && BloomBot"; sub="Mayflower Idle RPG, Mayflower Radio, Minecraft Forge mods, and BloomBot.";                          accent=$COL.violet;  art="$icons\favicon.png" }
  @{ file="idle-rpg.png";        kicker="Desktop game";         title="Mayflower Idle RPG";   sub="A fully idle fantasy chronicle — heroes live, travel, and leave heirs while you're away.";        accent=$COL.violet;  emoji="📖"; titleSize=58 }
  @{ file="watch-together.png";  kicker="Watch together";       title="Watch in perfect sync"; sub="YouTube and videos with live chat, shared queues, and playlists — in your own room.";             accent=$COL.rose;    emoji="📺"; titleSize=54 }
  @{ file="together.png";        kicker="Together";             title="A cozy room for two";  sub="Shared canvas, question cards, and little games — everything syncs live.";                        accent=$COL.rose;    emoji="💞"; titleSize=56 }
  @{ file="companion.png";       kicker="Companion";            title="A gentle companion";   sub="A soft presence for quiet moments — made with a bit of enchanted-forest magic.";                  accent=$COL.violet;  emoji="💫"; titleSize=56 }
  @{ file="date-night.png";      kicker="Date night";           title="Date Night";           sub="Prompts, games, and cozy things to do together — one shared screen at a time.";                   accent=$COL.rose;    emoji="🌹" }
  @{ file="sakari.png";          kicker="Interactive stories";  title="Sakari";               sub="Interactive stories with choices that matter, told with a soft little heartbeat.";                accent=$COL.emerald; emoji="🦊" }
  @{ file="contact.png";         kicker="Say hello";            title="Contact";              sub="Questions, bug reports, kind words — every message is read.";                                     accent=$COL.rose;    emoji="✉️" }
  @{ file="bots__bloombot.png";  kicker="Discord bot";          title="BloomBot";             sub="A gentle companion bot for cozy community spaces.";                                               accent=$COL.emerald; emoji="🌼" }
  @{ file="mods__steelhold.png";     kicker="Minecraft mod"; title="Steelhold";           sub="Player-owned safes, bindable keys, locked doors, and anvil-style physics.";  accent=$COL.gold;    art="$icons\steelhold.png" }
  @{ file="mods__logichest.png";     kicker="Minecraft mod"; title="LogiChest";           sub="Hub-and-sorter storage routing with clean rules and upgrade-based scaling.";  accent=$COL.emerald; art="$icons\logichest.png" }
  @{ file="mods__gentlecreeper.png"; kicker="Minecraft mod"; title="The Gentle Creeper";  sub="A creeper who just wants a friend. No explosions. Ever.";                     accent=$COL.emerald; art="$icons\gentlecreeper.png"; titleSize=52 }
  @{ file="mods__amumucurse.png";    kicker="Minecraft mod"; title="Amumu Curse";         sub="A quiet, sorrow-driven curse — subtle decay, uneasy villagers, ritual cures.";  accent=$COL.violet;  art="$icons\amumucurse.png" }
  @{ file="privacy.png"; kicker="The fine print"; title="Privacy";        sub="What's collected, what isn't, and how your data is treated.";  accent=$COL.emerald; emoji="🔒" }
  @{ file="tos.png";     kicker="The fine print"; title="Terms of Use";   sub="The friendly ground rules for using Mayflower Studios things."; accent=$COL.violet;  emoji="📜" }
  @{ file="404.png";     kicker="Lost in the forest"; title="Page not found"; sub="This path doesn't lead anywhere — let's head back home.";   accent=$COL.rose;    emoji="🧭"; titleSize=56 }
)

foreach ($p in $pages) {
  New-OgCard -file $p.file -kicker $p.kicker -title ($p.title -replace '&&', '&') -sub $p.sub `
    -accent $p.accent -art $p.art -emoji $p.emoji -titleSize ($(if ($p.titleSize) { $p.titleSize } else { 64 }))
}
Write-Host "done — $($pages.Count) cards in assets/og"
