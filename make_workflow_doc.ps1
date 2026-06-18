$ErrorActionPreference = "Stop"

$outputDocx = Join-Path $PSScriptRoot "WorkLance_Workflow_Guide.docx"
$buildRoot = Join-Path $PSScriptRoot "tmp_workflow_docx"

if (Test-Path $buildRoot) {
  Remove-Item -Recurse -Force $buildRoot
}

New-Item -ItemType Directory -Path $buildRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "_rels") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "docProps") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "word") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $buildRoot "word\_rels") | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
'@

$rootRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
'@

$appXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
            xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
'@

$timestamp = (Get-Date).ToUniversalTime().ToString("s") + "Z"
$coreXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:dcmitype="http://purl.org/dc/dcmitype/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>WorkLance Workflow Guide</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">$timestamp</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">$timestamp</dcterms:modified>
</cp:coreProperties>
"@

$documentRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
'@

$stylesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1F2937"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="0" w:after="180"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="34"/>
      <w:szCs w:val="34"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="180" w:after="80"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>
      <w:b/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
</w:styles>
'@

$documentXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 wp14">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>WorkLance Workflow Guide</w:t></w:r></w:p>
    <w:p><w:r><w:t>This brief guide explains how a client and freelancer use the WorkLance platform from account creation to payment approval.</w:t></w:r></w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Client Workflow</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Sign up as a client using MetaMask, full name, username, and profile details.</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Open the client dashboard and create a job listing with title, description, deadline, and payment amount.</w:t></w:r></w:p>
    <w:p><w:r><w:t>3. Review proposals submitted by freelancers for the posted job.</w:t></w:r></w:p>
    <w:p><w:r><w:t>4. Select a preferred freelancer and assign that freelancer to the job.</w:t></w:r></w:p>
    <w:p><w:r><w:t>5. Fund the escrow for the assigned job.</w:t></w:r></w:p>
    <w:p><w:r><w:t>6. Review the submitted work, then approve payment if the work is satisfactory.</w:t></w:r></w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Freelancer Workflow</w:t></w:r></w:p>
    <w:p><w:r><w:t>1. Sign up as a freelancer using MetaMask, full name, username, and profile details.</w:t></w:r></w:p>
    <w:p><w:r><w:t>2. Browse available jobs and open a relevant listing.</w:t></w:r></w:p>
    <w:p><w:r><w:t>3. Submit a proposal with bid amount, timeline, portfolio, and CV where required.</w:t></w:r></w:p>
    <w:p><w:r><w:t>4. After being selected by the client, move to the delivery stage.</w:t></w:r></w:p>
    <w:p><w:r><w:t>5. Submit work using project links, uploaded files, or delivery notes.</w:t></w:r></w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Messaging and Collaboration</w:t></w:r></w:p>
    <w:p><w:r><w:t>The messaging section allows the client and freelancer to communicate during the project. They can discuss requirements, updates, and delivery expectations before final approval.</w:t></w:r></w:p>

    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>End Result</w:t></w:r></w:p>
    <w:p><w:r><w:t>The intended workflow is: client posts a job, freelancer submits a proposal, client selects and assigns a freelancer, freelancer delivers work, and client approves payment.</w:t></w:r></w:p>

    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
'@

Set-Content -LiteralPath (Join-Path $buildRoot "[Content_Types].xml") -Value $contentTypes -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "_rels\.rels") -Value $rootRels -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "docProps\app.xml") -Value $appXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "docProps\core.xml") -Value $coreXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "word\document.xml") -Value $documentXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "word\styles.xml") -Value $stylesXml -Encoding UTF8
Set-Content -LiteralPath (Join-Path $buildRoot "word\_rels\document.xml.rels") -Value $documentRels -Encoding UTF8

$zipPath = Join-Path $PSScriptRoot "WorkLance_Workflow_Guide.zip"
if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}
if (Test-Path $outputDocx) {
  Remove-Item -Force $outputDocx
}

Compress-Archive -Path (Join-Path $buildRoot "*") -DestinationPath $zipPath -Force
Move-Item -LiteralPath $zipPath -Destination $outputDocx

Write-Output $outputDocx
