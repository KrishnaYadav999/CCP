$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outPath = Join-Path $root "docs\Lead_Generation_Compliance_Walkthrough.pptx"
$work = Join-Path $env:TEMP ("ccp_walkthrough_pptx_" + [guid]::NewGuid().ToString("N"))
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
<p:sp><p:nvSpPr><p:cNvPr id="$id" name="Shape $id"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="$(Emu $x)" y="$(Emu $y)"/><a:ext cx="$(Emu $w)" cy="$(Emu $h)"/></a:xfrm><a:prstGeom prst="$radius"><a:avLst/></a:prstGeom>$(Solid $fill)<a:ln><a:solidFill><a:srgbClr val="$line"/></a:solidFill></a:ln></p:spPr></p:sp>
"@
}

function TextBox($id, $x, $y, $w, $h, $text, $size = 20, $color = "0F172A", $bold = $true, $align = "l") {
  return @"
<p:sp><p:nvSpPr><p:cNvPr id="$id" name="Text $id"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="$(Emu $x)" y="$(Emu $y)"/><a:ext cx="$(Emu $w)" cy="$(Emu $h)"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="mid"/><a:lstStyle/><a:p><a:pPr algn="$align"/>$(TextRun $text $size $color $bold)</a:p></p:txBody></p:sp>
"@
}

function BulletList($id, $x, $y, $w, $h, $items, $size = 14) {
  $paras = ""
  foreach ($item in $items) {
    $paras += "<a:p><a:pPr marL=`"240000`" indent=`"-140000`"><a:buChar char=`"-`"/></a:pPr>$(TextRun $item $size "334155" $false)</a:p>"
  }
  return @"
<p:sp><p:nvSpPr><p:cNvPr id="$id" name="Bullets $id"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="$(Emu $x)" y="$(Emu $y)"/><a:ext cx="$(Emu $w)" cy="$(Emu $h)"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>$paras</p:txBody></p:sp>
"@
}

function Logo($id, $x, $y) {
  return @"
$(TextBox ($id + 1) $x $y 2.35 0.44 "ANANT" 28 "F97316" $true "l")
$(TextBox ($id + 2) $x ($y + 0.42) 2.35 0.32 "TATTVA" 18 "111827" $false "l")
"@
}

function Header($title, $subtitle = "http://localhost:8080/sales/lead-generation") {
  return @"
$(Logo 10 0.45 0.28)
$(TextBox 20 3.1 0.32 7.8 0.38 $title 22 "020617" $true "l")
$(TextBox 21 3.1 0.76 7.8 0.22 $subtitle 9 "64748B" $false "l")
$(Shape 22 0.45 1.22 12.4 0.02 "D1FAE5" "D1FAE5" "rect")
"@
}

function Card($id, $x, $y, $w, $h, $title, $body, $accent = "047857") {
  return @"
$(Shape $id $x $y $w $h "FFFFFF" "DDE8F0")
$(Shape ($id + 1) $x $y 0.11 $h $accent $accent "rect")
$(TextBox ($id + 2) ($x + 0.28) ($y + 0.18) ($w - 0.45) 0.28 $title 15 $accent $true "l")
$(TextBox ($id + 3) ($x + 0.28) ($y + 0.62) ($w - 0.55) ($h - 0.8) $body 11 "475569" $false "l")
"@
}

function SlideXml($body) {
  return @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr>$(Solid "F8FAFC")</p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>$body</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>
"@
}

$slides = @()
$slides += SlideXml (@"
$(Shape 2 0 0 13.33 7.5 "ECFDF5" "ECFDF5" "rect")
$(Shape 3 0.65 0.55 12.03 6.4 "FFFFFF" "D1FAE5")
$(Logo 10 0.95 0.9)
$(TextBox 20 0.95 2.0 9.8 0.75 "Sales Lead Generator & Compliance Health Report" 32 "020617" $true "l")
$(TextBox 21 0.98 2.92 8.9 0.58 "Professional English walkthrough of every section and input on the Lead Generation page and its Compliance Health Report workflow." 15 "475569" $false "l")
$(Shape 22 0.98 3.8 3.5 0.55 "047857" "047857")
$(TextBox 23 1.12 3.91 3.2 0.25 "ANANT TATTVA CRM" 13 "FFFFFF" $true "c")
$(Shape 24 4.75 3.8 4.8 0.55 "FFF7ED" "FED7AA")
$(TextBox 25 4.95 3.91 4.4 0.25 "Route: /sales/lead-generation" 13 "C2410C" $true "c")
"@)

$slides += SlideXml (@"
$(Header "Complete User Journey")
$(Shape 30 0.75 1.9 2.05 0.82 "ECFDF5" "A7F3D0")
$(TextBox 31 0.9 2.14 1.75 0.22 "1. Company" 14 "047857" $true "c")
$(Shape 32 3.0 1.9 2.05 0.82 "EFF6FF" "BFDBFE")
$(TextBox 33 3.15 2.14 1.75 0.22 "2. Address" 14 "1D4ED8" $true "c")
$(Shape 34 5.25 1.9 2.05 0.82 "FFF7ED" "FED7AA")
$(TextBox 35 5.4 2.14 1.75 0.22 "3. Contact" 14 "C2410C" $true "c")
$(Shape 36 7.5 1.9 2.05 0.82 "FFFFFF" "CBD5E1")
$(TextBox 37 7.65 2.14 1.75 0.22 "4. Assign" 14 "0F172A" $true "c")
$(Shape 38 9.75 1.9 2.4 0.82 "047857" "047857")
$(TextBox 39 9.9 2.14 2.1 0.22 "5. Report" 14 "FFFFFF" $true "c")
$(BulletList 40 0.95 3.55 11.2 1.9 @("The page starts with structured lead entry across four tabs.", "Submit opens a decision popup: process Compliance Health Report or submit lead only.", "The report view keeps lead details out and asks only compliance-specific information.", "Final confirmation saves the report, evidence metadata and workflow status to the database.") 15)
"@)

$slides += SlideXml (@"
$(Header "Top Bar, Excel Import & Draft Tools")
$(BulletList 30 0.75 1.75 5.6 3.4 @("Back control returns to the prior dashboard area.", "Step badge communicates workflow progress and unlocked status.", "Upload Excel supports bulk lead creation from spreadsheet data.", "Import Drafts restores incomplete leads so users can continue without retyping.") 14)
$(Card 40 7.0 1.65 4.9 0.9 "Upload Excel" "Bulk upload lead data using mapped columns such as Company, Status, PIBO Category, Services Offered, Address, City, PIN, State and Contact Person." "1D4ED8")
$(Card 50 7.0 2.8 4.9 0.9 "Import Drafts" "Bring back saved draft leads and continue the workflow from the last completed step." "047857")
$(Card 60 7.0 3.95 4.9 0.9 "Workflow Badge" "Shows the current step and makes the page feel guided, controlled and review-ready." "C2410C")
"@)

$slides += SlideXml (@"
$(Header "Lead Section 1: Company")
$(BulletList 30 0.75 1.72 5.95 4.1 @("Lead ID: auto-generated for manual entries using the next ATPL-LEAD number.", "Client Communication Mode: channel through which the lead was received.", "Status: current sales state such as Potential, Need Assistance, Lost or Existing Client.", "Company: legal or trade name of the lead.", "Industry Type, EPR Category, PIBO Category and Services Offered: classification fields for routing and compliance context.") 13)
$(Card 40 7.05 1.62 4.95 0.86 "Required Decision Fields" "Company, Status, PIBO Category and Services Offered must be completed before moving ahead." "047857")
$(Card 50 7.05 2.72 4.95 0.86 "Selectable Controls" "Dropdown-style controls allow users to select an existing option or type a new value." "1D4ED8")
$(Card 60 7.05 3.82 4.95 0.86 "Manual Entry Safety" "Lead ID generation protects manual users from duplicate or missing lead numbering." "C2410C")
"@)

$slides += SlideXml (@"
$(Header "Lead Section 2: Address")
$(BulletList 30 0.75 1.72 5.95 4.1 @("Address Line 1: primary business address and required location reference.", "Address Line 2 and Address Line 3: additional address details.", "Landmark: supports field identification and local context.", "State and City: structured location selection; City depends on selected State.", "PIN Code, Existing Client and Website: postal, CRM and online identity context.") 13)
$(Card 40 7.05 1.65 4.95 0.86 "Location Integrity" "State and City structure improves filtering, assignment and future reporting." "1D4ED8")
$(Card 50 7.05 2.75 4.95 0.86 "Client Context" "Existing Client marks whether this is new business or an existing relationship." "047857")
$(Card 60 7.05 3.85 4.95 0.86 "Website" "Captures a quick external reference for sales and compliance verification." "C2410C")
"@)

$slides += SlideXml (@"
$(Header "Lead Section 3: Contact")
$(BulletList 30 0.75 1.72 5.95 4.1 @("Salutation and Contact Person: the person responsible from client side.", "Designation: role or authority level of the contact.", "Email(s): one or multiple email addresses for communication.", "Mobile No. 1 and Mobile No. 2: primary and backup phone contacts.", "Business Card upload: visual contact reference stored with the lead.") 13)
$(Card 40 7.05 1.65 4.95 0.86 "Communication Ready" "All contact fields support fast follow-up and assignment clarity." "C2410C")
$(Card 50 7.05 2.75 4.95 0.86 "Business Card" "A file/image reference helps staff verify details quickly." "047857")
$(Card 60 7.05 3.85 4.95 0.86 "Clean CRM Record" "Contact data is separated from address and assignment data for easier scanning." "1D4ED8")
"@)

$slides += SlideXml (@"
$(Header "Lead Section 4: Assign & Additional Information")
$(BulletList 30 0.75 1.72 5.95 4.15 @("Assign To Staff: routes the lead to a team member.", "Assigned To Text and Assigned By: manual tracking context.", "Created By, Created At and Updated At: import or workflow timestamps.", "Referred By and Source: lead attribution.", "Emails Sent Count, Last Email Sent, Lead Date, Next Follow-Up Date/Time and Remarks support sales follow-up discipline.") 12)
$(Card 40 7.05 1.65 4.95 0.86 "Save Draft" "Keeps the lead editable without marking it as complete." "C2410C")
$(Card 50 7.05 2.75 4.95 0.86 "Submit" "Opens the decision popup for Compliance Health Report processing." "047857")
$(Card 60 7.05 3.85 4.95 0.86 "Follow-Up Data" "Keeps sales action items visible and accountable." "1D4ED8")
"@)

$slides += SlideXml (@"
$(Header "Submit Decision Popup")
$(BulletList 30 0.75 1.75 5.9 3.75 @("The popup asks: Do you want to process for COMPLIANCE HEALTH REPORT?", "Yes opens the dedicated report page.", "No reveals a review checkbox before lead-only submission.", "The checkbox message confirms the user checked all entered details.", "This step prevents accidental submissions and gives a clear audit checkpoint.") 13)
$(Shape 40 7.05 1.65 4.9 3.35 "FFFFFF" "D1FAE5")
$(TextBox 41 7.35 1.95 4.3 0.35 "Decision Modal" 20 "047857" $true "l")
$(Shape 42 7.35 2.8 1.85 0.6 "047857" "047857")
$(TextBox 43 7.55 2.97 1.45 0.22 "Yes" 14 "FFFFFF" $true "c")
$(Shape 44 9.55 2.8 1.85 0.6 "FFFFFF" "CBD5E1")
$(TextBox 45 9.75 2.97 1.45 0.22 "No" 14 "334155" $true "c")
"@)

$slides += SlideXml (@"
$(Header "Compliance Report Header")
$(BulletList 30 0.75 1.75 5.85 3.75 @("The report opens as a focused compliance workspace.", "Stats show Overview Fields, Observation Rows, Checklist Items and Screenshots.", "Progress rail highlights Overview, Objective, Observations and Evidence.", "Lead details already captured earlier are not repeated here.", "This keeps the report shorter and easier to complete.") 13)
$(Card 40 7.05 1.65 4.95 0.86 "Overview Fields" "Counts the core report-specific company overview inputs." "047857")
$(Card 50 7.05 2.75 4.95 0.86 "Observation Rows" "Counts findings from compliance and annual return tables." "1D4ED8")
$(Card 60 7.05 3.85 4.95 0.86 "Evidence" "Tracks screenshots and supporting files uploaded to the report." "C2410C")
"@)

$slides += SlideXml (@"
$(Header "Report Section 1: Company Overview")
$(BulletList 30 0.75 1.72 5.95 4.25 @("Year of Commencement of Operations: first year of business operations.", "Year of Establishment: establishment or registration date.", "Type of Organization: business classification.", "Product Category and EPR Registration Number: regulatory identification.", "Financial Year Reviewed: period covered by this compliance report.", "Key Products / Brands: multi-select evidence field instead of a plain input.") 12)
$(Card 40 7.05 1.65 4.95 0.86 "Key Products / Brands" "Uses a chip-based multi-select with Uploaded in shared folder." "047857")
$(Card 50 7.05 2.75 4.95 0.86 "Product Category" "Captures product classification for compliance review." "1D4ED8")
$(Card 60 7.05 3.85 4.95 0.86 "EPR Registration Number" "Stores the official EPR registration reference." "C2410C")
"@)

$slides += SlideXml (@"
$(Header "Uploaded in Shared Folder")
$(BulletList 30 0.75 1.72 5.95 4.05 @("When selected, a professional upload panel appears below Key Products / Brands.", "Choose Files supports multiple direct file uploads.", "Choose Folder supports folder upload in compatible browsers.", "Uploaded rows show file name, relative folder path or type, size and remove action.", "Shared folder uploads save lightweight metadata with the report.") 13)
$(Shape 40 7.05 1.7 4.9 0.75 "FFFFFF" "A7F3D0")
$(TextBox 41 7.35 1.92 4.3 0.22 "Choose Files" 15 "047857" $true "c")
$(Shape 42 7.05 2.65 4.9 0.75 "047857" "047857")
$(TextBox 43 7.35 2.87 4.3 0.22 "Choose Folder" 15 "FFFFFF" $true "c")
$(Shape 44 7.05 3.6 4.9 0.75 "FFF7ED" "FED7AA")
$(TextBox 45 7.35 3.82 4.3 0.22 "Uploaded File List" 15 "C2410C" $true "c")
"@)

$slides += SlideXml (@"
$(Header "Report Section 2: Objective of Review")
$(BulletList 30 0.75 1.75 5.95 3.8 @("Large textarea captures the purpose of the review.", "The user can mention the portal, registration data, rules and review scope.", "This section frames the rest of the report for readers.", "It should explain why the report is being prepared and what risks are being checked.") 14)
$(Shape 40 7.05 1.85 4.9 2.1 "FFFFFF" "CBD5E1")
$(TextBox 41 7.35 2.18 4.3 0.3 "Objective Text Area" 19 "0F172A" $true "l")
$(TextBox 42 7.35 2.92 4.0 0.5 "Review submitted portal data, identify gaps, inconsistencies and potential regulatory risks." 12 "475569" $false "l")
"@)

$slides += SlideXml (@"
$(Header "Report Section 3.1: Key Compliance Observations")
$(BulletList 30 0.75 1.72 5.95 4.15 @("Sr. No.: traceable row number.", "Area: compliance part such as Part A General Information.", "Observation: exact gap, mismatch or missing data.", "Potential Risk: compliance exposure caused by the observation.", "Screenshot Reference: file/evidence connection.", "Action: remove row; Add Row creates more observations.") 12)
$(Card 40 7.05 1.65 4.95 0.86 "Observation Table" "Designed for compliance gaps and supporting evidence." "047857")
$(Card 50 7.05 2.75 4.95 0.86 "Screenshot Reference" "Supports Choose Files and selected file names for each row." "1D4ED8")
$(Card 60 7.05 3.85 4.95 0.86 "Add Row" "Allows unlimited findings without changing the page structure." "C2410C")
"@)

$slides += SlideXml (@"
$(Header "Report Section 3.2: Annual Return Observations")
$(BulletList 30 0.75 1.75 10.8 3.25 @("Annual Return observations are separated from general compliance findings.", "Default Area is Annual Return so the user starts faster.", "Use this section for missing annual returns, missing sales data, outdated submissions or quantity mismatch.", "The same Sr. No., Observation, Potential Risk and Screenshot Reference pattern keeps the report consistent.") 14)
$(Shape 40 0.95 5.15 10.95 0.6 "ECFDF5" "A7F3D0")
$(TextBox 41 1.15 5.3 10.55 0.22 "Purpose: keep annual return gaps clear, auditable and separate from registration-level observations." 14 "047857" $true "c")
"@)

$slides += SlideXml (@"
$(Header "Report Section 4: Compliance Checklist Review")
$(BulletList 30 0.75 1.72 5.95 4.2 @("Grouped checklist review covers Part A, Authorized Person Details, Operational Details and Documents.", "Compliance Requirement contains the item being checked.", "Status captures Yes, No, Uploaded, Not Uploaded, Mentioned or Not Applicable.", "Remark captures reviewer notes.", "Grouped layout reduces repeated Part labels and keeps the long checklist scannable.") 12)
$(Card 40 7.05 1.65 4.95 0.86 "Part A" "Legal/trade name, type of company, type of business, CIN, PAN and registered address." "047857")
$(Card 50 7.05 2.75 4.95 0.86 "Authorized Person" "Name, designation, PAN, mobile number and email ID." "1D4ED8")
$(Card 60 7.05 3.85 4.95 0.86 "Documents" "Portal documents, product details, photographs and other supporting information." "C2410C")
"@)

$slides += SlideXml (@"
$(Header "Evidence: Screenshot Reference")
$(BulletList 30 0.75 1.75 5.95 3.8 @("Bulk Upload supports many screenshots, PDFs or supporting images.", "Preview cards show uploaded evidence with file name and size.", "Each uploaded item has a remove action.", "A file-count badge confirms the amount of evidence attached.", "This section centralizes evidence for the full report.") 13)
$(Shape 40 7.05 1.75 4.9 0.75 "FFFFFF" "A7F3D0")
$(TextBox 41 7.35 1.97 4.3 0.22 "Choose Files" 15 "047857" $true "c")
$(Shape 42 7.05 2.75 4.9 0.75 "047857" "047857")
$(TextBox 43 7.35 2.97 4.3 0.22 "Bulk Upload" 15 "FFFFFF" $true "c")
$(Shape 44 7.05 3.75 4.9 0.75 "FFFFFF" "CBD5E1")
$(TextBox 45 7.35 3.97 4.3 0.22 "Preview Cards" 15 "0F172A" $true "c")
"@)

$slides += SlideXml (@"
$(Header "Final Notes: Conclusion & Next Steps")
$(BulletList 30 0.75 1.75 5.95 3.8 @("Conclusion and Recommendations appear side-by-side in a 50/50 layout.", "Rows are numbered 1, 2, 3 and so on.", "Add Note creates another conclusion/recommendation pair.", "Cut button removes an extra row.", "Previously saved text can be frozen to protect reviewed content.") 13)
$(Shape 40 7.05 1.95 2.25 0.62 "ECFDF5" "A7F3D0")
$(TextBox 41 7.25 2.12 1.85 0.22 "Conclusion" 14 "047857" $true "c")
$(Shape 42 9.55 1.95 2.25 0.62 "ECFDF5" "A7F3D0")
$(TextBox 43 9.75 2.12 1.85 0.22 "Recommendations" 14 "047857" $true "c")
$(Shape 44 7.8 3.15 3.0 0.55 "FFFFFF" "A7F3D0")
$(TextBox 45 8.0 3.27 2.6 0.22 "Add Note" 14 "047857" $true "c")
"@)

$slides += SlideXml (@"
$(Header "Final Review Popup & Database Save")
$(BulletList 30 0.75 1.72 5.95 4.1 @("Submit Report opens a final review popup.", "The checkbox says: I have reviewed all the details I entered, and they are correct.", "Submit remains disabled until the checkbox is selected.", "Saved report includes overview fields, observations, checklist review, screenshots, shared folder uploads, final notes, reviewed confirmation and submittedAt timestamp.", "Workflow status is set to submitted after a successful save.") 12)
$(Shape 40 7.05 1.8 4.9 3.05 "FFFFFF" "FED7AA")
$(TextBox 41 7.35 2.08 4.3 0.3 "Submit COMPLIANCE HEALTH REPORT" 16 "0F172A" $true "l")
$(Shape 42 7.35 2.9 3.9 0.5 "FFF7ED" "FED7AA")
$(TextBox 43 7.55 3.02 3.5 0.2 "Reviewed confirmation checkbox" 12 "C2410C" $true "c")
$(Shape 44 8.25 3.8 2.2 0.55 "F97316" "F97316")
$(TextBox 45 8.45 3.92 1.8 0.22 "Submit" 13 "FFFFFF" $true "c")
"@)

$slides += SlideXml (@"
$(Shape 2 0 0 13.33 7.5 "FFFFFF" "FFFFFF" "rect")
$(Logo 10 0.75 0.62)
$(TextBox 20 0.75 1.55 10.0 0.65 "Professional, Audit-Ready Reporting Flow" 30 "020617" $true "l")
$(BulletList 30 0.95 2.55 10.8 2.75 @("Modern tabbed lead entry for sales operations.", "Report page removes duplicate lead details and focuses on compliance-specific inputs.", "Evidence-first design with screenshots and shared folder file/folder uploads.", "Structured observations, annual return review and checklist tracking.", "Confirmation-driven final submission improves accuracy and accountability.") 15)
$(Shape 40 0.95 5.85 3.2 0.55 "047857" "047857")
$(TextBox 41 1.15 5.97 2.8 0.22 "ANANT TATTVA" 14 "FFFFFF" $true "c")
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
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>
$slideIds  </p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>
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
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Lead Generation Compliance Walkthrough</dc:title><dc:creator>Anant Tattva</dc:creator><cp:lastModifiedBy>Anant Tattva</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">$((Get-Date).ToUniversalTime().ToString("s"))Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">$((Get-Date).ToUniversalTime().ToString("s"))Z</dcterms:modified></cp:coreProperties>
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
