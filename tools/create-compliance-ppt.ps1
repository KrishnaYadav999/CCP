$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "docs\Compliance_Health_Report_Presentation.pptx"
$work = Join-Path $env:TEMP ("ccp_pptx_" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $work | Out-Null

function Write-Utf8File($path, $content) {
  $dir = Split-Path -Parent $path
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

function XmlEscape($text) {
  return [System.Security.SecurityElement]::Escape([string]$text)
}

function Emu($inches) {
  return [int]([double]$inches * 914400)
}

function Solid($hex) {
  return "<a:solidFill><a:srgbClr val=`"$hex`"/></a:solidFill>"
}

function TextRun($text, $size, $color = "0F172A", $bold = $true) {
  $b = if ($bold) { " b=`"1`"" } else { "" }
  return "<a:r><a:rPr lang=`"en-US`" sz=`"$([int]($size * 100))`"$b><a:solidFill><a:srgbClr val=`"$color`"/></a:solidFill></a:rPr><a:t>$(XmlEscape $text)</a:t></a:r>"
}

function Shape($id, $x, $y, $w, $h, $fill, $line = "FFFFFF", $radius = "roundRect") {
  return @"
<p:sp>
  <p:nvSpPr><p:cNvPr id="$id" name="Shape $id"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="$(Emu $x)" y="$(Emu $y)"/><a:ext cx="$(Emu $w)" cy="$(Emu $h)"/></a:xfrm><a:prstGeom prst="$radius"><a:avLst/></a:prstGeom>$(Solid $fill)<a:ln><a:solidFill><a:srgbClr val="$line"/></a:solidFill></a:ln></p:spPr>
</p:sp>
"@
}

function TextBox($id, $x, $y, $w, $h, $text, $size = 20, $color = "0F172A", $bold = $true, $align = "l") {
  return @"
<p:sp>
  <p:nvSpPr><p:cNvPr id="$id" name="Text $id"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="$(Emu $x)" y="$(Emu $y)"/><a:ext cx="$(Emu $w)" cy="$(Emu $h)"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
  <p:txBody><a:bodyPr wrap="square" anchor="mid"/><a:lstStyle/><a:p><a:pPr algn="$align"/>$(TextRun $text $size $color $bold)</a:p></p:txBody>
</p:sp>
"@
}

function BulletList($id, $x, $y, $w, $h, $items) {
  $paras = ""
  foreach ($item in $items) {
    $paras += "<a:p><a:pPr marL=`"285750`" indent=`"-171450`"><a:buChar char=`"•`"/></a:pPr>$(TextRun $item 16 "334155" $false)</a:p>"
  }
  return @"
<p:sp>
  <p:nvSpPr><p:cNvPr id="$id" name="Bullets $id"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
  <p:spPr><a:xfrm><a:off x="$(Emu $x)" y="$(Emu $y)"/><a:ext cx="$(Emu $w)" cy="$(Emu $h)"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
  <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>$paras</p:txBody>
</p:sp>
"@
}

function Logo($id, $x, $y) {
  return @"
$(TextBox ($id + 1) $x $y 2.25 0.45 "ANANT" 28 "F97316" $true "l")
$(TextBox ($id + 2) $x ($y + 0.42) 2.25 0.35 "TATTVA" 18 "111827" $false "l")
"@
}

function SlideXml($body) {
  return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:bg><p:bgPr>$(Solid "F8FAFC")</p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>$body</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>
"@
}

$slides = @()
$slides += SlideXml (@"
$(Shape 2 0 0 13.33 7.5 "ECFDF5" "ECFDF5" "rect")
$(Shape 3 0.65 0.55 12.03 6.4 "FFFFFF" "D1FAE5")
$(Logo 10 0.95 0.85)
$(TextBox 20 0.95 2.05 8.8 0.75 "Compliance Health Report" 38 "020617" $true "l")
$(TextBox 21 0.98 2.88 7.9 0.5 "Professional workflow for compliance review, evidence tracking, checklist validation, and final submission." 16 "475569" $false "l")
$(Shape 22 0.98 3.65 3.1 0.55 "047857" "047857")
$(TextBox 23 1.12 3.72 2.8 0.35 "Lead-to-report workflow" 14 "FFFFFF" $true "c")
"@)

$slides += SlideXml (@"
$(Logo 10 0.55 0.35)
$(TextBox 20 0.55 1.15 6.5 0.5 "Page Workflow" 28 "020617" $true "l")
$(Shape 30 0.7 2.1 2.5 1.1 "ECFDF5" "A7F3D0")
$(TextBox 31 0.95 2.42 2 0.35 "Lead Capture" 18 "065F46" $true "c")
$(Shape 32 3.55 2.1 2.5 1.1 "EFF6FF" "BFDBFE")
$(TextBox 33 3.78 2.42 2.05 0.35 "Report Form" 18 "1D4ED8" $true "c")
$(Shape 34 6.4 2.1 2.5 1.1 "FFF7ED" "FED7AA")
$(TextBox 35 6.63 2.42 2.05 0.35 "Evidence Upload" 18 "C2410C" $true "c")
$(Shape 36 9.25 2.1 2.5 1.1 "F8FAFC" "CBD5E1")
$(TextBox 37 9.48 2.42 2.05 0.35 "Final Submit" 18 "0F172A" $true "c")
$(BulletList 40 0.9 4.0 10.8 1.4 @("Avoids repeated lead data in report view", "Supports compliance observations, annual return gaps, checklist review and evidence", "Includes confirmation prompts before final submission"))
"@)

$slides += SlideXml (@"
$(Logo 10 0.55 0.35)
$(TextBox 20 0.55 1.05 8.5 0.5 "Company Overview" 28 "020617" $true "l")
$(BulletList 30 0.8 1.95 5.5 3.2 @("Year of commencement and establishment", "Organization type and EPR registration number", "Financial year reviewed", "Key Products / Brands as multi-select"))
$(Shape 40 6.9 1.8 5.4 3.35 "FFFFFF" "BFDBFE")
$(TextBox 41 7.25 2.15 4.6 0.4 "Key Products / Brands" 20 "0F172A" $true "l")
$(Shape 42 7.25 2.85 4.2 0.55 "ECFDF5" "A7F3D0")
$(TextBox 43 7.45 2.97 3.8 0.25 "Uploaded in shared folder" 14 "047857" $true "c")
"@)

$slides += SlideXml (@"
$(Logo 10 0.55 0.35)
$(TextBox 20 0.55 1.05 8.5 0.5 "Shared Folder Upload" 28 "020617" $true "l")
$(TextBox 21 0.58 1.65 8.6 0.45 "Users can select the shared-folder status and then upload files or an entire folder for supporting product/brand evidence." 15 "475569" $false "l")
$(Shape 30 0.8 2.6 3.3 1.15 "FFFFFF" "A7F3D0")
$(TextBox 31 1.05 2.95 2.8 0.35 "Choose Files" 18 "047857" $true "c")
$(Shape 32 4.55 2.6 3.3 1.15 "047857" "047857")
$(TextBox 33 4.8 2.95 2.8 0.35 "Choose Folder" 18 "FFFFFF" $true "c")
$(BulletList 40 0.9 4.45 10.8 1.25 @("Stores file names, size, upload date and folder path metadata", "Supports multiple files and full folder selection", "Keeps evidence organized inside the compliance report"))
"@)

$slides += SlideXml (@"
$(Logo 10 0.55 0.35)
$(TextBox 20 0.55 1.05 8.5 0.5 "Compliance Observations" 28 "020617" $true "l")
$(BulletList 30 0.8 1.95 5.4 3.5 @("3.1 Key Compliance Observations", "3.2 Annual Return Observations", "Area, observation, potential risk and screenshot reference", "Dynamic rows with upload support"))
$(Shape 40 6.75 1.7 5.6 3.7 "FFFFFF" "CBD5E1")
$(TextBox 41 7.05 2.05 5 0.35 "Observation Table UI" 20 "0F172A" $true "l")
$(TextBox 42 7.05 2.75 4.9 0.35 "Sr. No. | Area | Observation | Risk | Screenshot" 13 "475569" $false "l")
$(Shape 43 7.05 3.45 4.6 0.45 "ECFDF5" "A7F3D0")
$(TextBox 44 7.22 3.55 4.2 0.25 "Multiple image evidence supported" 13 "047857" $true "c")
"@)

$slides += SlideXml (@"
$(Logo 10 0.55 0.35)
$(TextBox 20 0.55 1.05 8.5 0.5 "Checklist Review" 28 "020617" $true "l")
$(BulletList 30 0.8 1.95 10.9 3.2 @("Grouped checklist sections: Part A, Authorized Person Details, Operational Details and Documents", "Each item captures status and remarks", "Centered, compact inputs keep long reports easier to scan", "Designed for repeated compliance review work"))
"@)

$slides += SlideXml (@"
$(Logo 10 0.55 0.35)
$(TextBox 20 0.55 1.05 8.5 0.5 "Final Notes & Review" 28 "020617" $true "l")
$(BulletList 30 0.8 1.9 5.6 3.2 @("Conclusion and recommendations appear side by side", "Add more note pairs as needed", "Existing saved notes can be frozen for review stability", "Cut button removes extra rows"))
$(Shape 40 6.85 2.0 2.45 0.75 "ECFDF5" "A7F3D0")
$(TextBox 41 7.05 2.23 2.05 0.25 "Conclusion" 16 "047857" $true "c")
$(Shape 42 9.55 2.0 2.45 0.75 "ECFDF5" "A7F3D0")
$(TextBox 43 9.75 2.23 2.05 0.25 "Recommendations" 16 "047857" $true "c")
$(Shape 44 7.95 3.35 2.8 0.65 "F97316" "F97316")
$(TextBox 45 8.15 3.53 2.4 0.25 "Submit Report" 15 "FFFFFF" $true "c")
"@)

$slides += SlideXml (@"
$(Shape 2 0 0 13.33 7.5 "FFFFFF" "FFFFFF" "rect")
$(Logo 10 0.75 0.6)
$(TextBox 20 0.75 1.65 9.5 0.6 "Professional Compliance Reporting Experience" 30 "020617" $true "l")
$(BulletList 30 0.95 2.65 10.8 2.4 @("Clean, modern interface for operational compliance teams", "Evidence-first report flow with screenshots and shared folder uploads", "Structured checklist review and final confirmation", "Ready for database-backed CRM workflow"))
$(Shape 40 0.95 5.7 3.2 0.55 "047857" "047857")
$(TextBox 41 1.15 5.82 2.8 0.25 "ANANT TATTVA" 14 "FFFFFF" $true "c")
"@)

Write-Utf8File (Join-Path $work "[Content_Types].xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
$(($slides | ForEach-Object -Begin {$i=1} -Process {"  <Override PartName=`"/ppt/slides/slide$i.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.presentationml.slide+xml`"/>"; $i++}) -join "`n")
</Types>
"@

Write-Utf8File (Join-Path $work "_rels\.rels") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"@

$slideIds = ""
$rels = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
"@
for ($i = 1; $i -le $slides.Count; $i++) {
  $slideIds += "    <p:sldId id=`"$($i + 255)`" r:id=`"rId$($i + 2)`"/>`n"
  $rels += "  <Relationship Id=`"rId$($i + 2)`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide`" Target=`"slides/slide$i.xml`"/>`n"
}
$rels += "</Relationships>"

Write-Utf8File (Join-Path $work "ppt\presentation.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>
$slideIds  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="wide"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>
"@
Write-Utf8File (Join-Path $work "ppt\_rels\presentation.xml.rels") $rels

for ($i = 0; $i -lt $slides.Count; $i++) {
  Write-Utf8File (Join-Path $work "ppt\slides\slide$($i + 1).xml") $slides[$i]
}

Write-Utf8File (Join-Path $work "ppt\slideMasters\slideMaster1.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>
"@
Write-Utf8File (Join-Path $work "ppt\slideMasters\_rels\slideMaster1.xml.rels") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>
"@
Write-Utf8File (Join-Path $work "ppt\slideLayouts\slideLayout1.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>
"@
Write-Utf8File (Join-Path $work "ppt\slideLayouts\_rels\slideLayout1.xml.rels") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
"@
Write-Utf8File (Join-Path $work "ppt\theme\theme1.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Anant Tattva"><a:themeElements><a:clrScheme name="Anant"><a:dk1><a:srgbClr val="020617"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="047857"/></a:accent1><a:accent2><a:srgbClr val="F97316"/></a:accent2><a:accent3><a:srgbClr val="0EA5E9"/></a:accent3><a:accent4><a:srgbClr val="64748B"/></a:accent4><a:accent5><a:srgbClr val="10B981"/></a:accent5><a:accent6><a:srgbClr val="FB923C"/></a:accent6><a:hlink><a:srgbClr val="0EA5E9"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>
"@
Write-Utf8File (Join-Path $work "docProps\core.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Compliance Health Report</dc:title><dc:creator>Anant Tattva</dc:creator><cp:lastModifiedBy>Anant Tattva</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">$((Get-Date).ToUniversalTime().ToString("s"))Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">$((Get-Date).ToUniversalTime().ToString("s"))Z</dcterms:modified></cp:coreProperties>
"@
Write-Utf8File (Join-Path $work "docProps\app.xml") @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Codex</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>$($slides.Count)</Slides></Properties>
"@

if (Test-Path $outPath) { Remove-Item -LiteralPath $outPath -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($outPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -LiteralPath $work -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($work.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $relative) | Out-Null
  }
} finally {
  $archive.Dispose()
}
Remove-Item -LiteralPath $work -Recurse -Force
Write-Host "Created $outPath"
