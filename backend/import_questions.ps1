param(
  [string]$JsonPath = ".\pdr_final_fixed.json",
  [string]$ApiUrl = "http://127.0.0.1:8000/questions/import"
)

$ErrorActionPreference = "Stop"

$keys = ConvertFrom-Json @'
{
  "section": "\u0440\u043e\u0437\u0434\u0456\u043b",
  "section_name": "\u043d\u0430\u0437\u0432\u0430_\u0440\u043e\u0437\u0434\u0456\u043b\u0443",
  "num_in_section": "\u043d\u043e\u043c\u0435\u0440_\u0432_\u0440\u043e\u0437\u0434\u0456\u043b\u0456",
  "category": "\u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0456\u044f",
  "categories": "\u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0456\u0457",
  "difficulty": "\u0441\u043a\u043b\u0430\u0434\u043d\u0456\u0441\u0442\u044c",
  "explanation": "\u043f\u043e\u044f\u0441\u043d\u0435\u043d\u043d\u044f",
  "question_text": "\u0442\u0435\u043a\u0441\u0442_\u043f\u0438\u0442\u0430\u043d\u043d\u044f",
  "options": "\u0432\u0430\u0440\u0456\u0430\u043d\u0442\u0438",
  "correct_ans": "\u043f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u0430_\u0432\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u044c",
  "images": "\u043a\u0430\u0440\u0442\u0438\u043d\u043a\u0438",
  "page": "\u0441\u0442\u043e\u0440\u0456\u043d\u043a\u0430"
}
'@

function Resolve-ImportPath {
  param([string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return $PathValue
  }

  return Join-Path $PSScriptRoot $PathValue
}

$resolvedJsonPath = Resolve-ImportPath -PathValue $JsonPath

if (-not (Test-Path -LiteralPath $resolvedJsonPath)) {
  throw "JSON file not found: $resolvedJsonPath"
}

Write-Host "Reading questions from $resolvedJsonPath" -ForegroundColor Cyan

$raw = Get-Content -Raw -Encoding UTF8 $resolvedJsonPath | ConvertFrom-Json

$payload = foreach ($q in $raw) {
  [pscustomobject]@{
    id = [int]$q.id
    section = [string]$q.($keys.section)
    section_name = [string]$q.($keys.section_name)
    num_in_section = $q.($keys.num_in_section)
    category = if ($q.PSObject.Properties.Name -contains $keys.category) {
      [string]$q.($keys.category)
    } elseif (($q.PSObject.Properties.Name -contains $keys.categories) -and $q.($keys.categories)) {
      [string]($q.($keys.categories) | Select-Object -First 1)
    } else {
      $null
    }
    difficulty = [string]$q.($keys.difficulty)
    explanation = [string]$q.($keys.explanation)
    question_text = [string]$q.($keys.question_text)
    options = @($q.($keys.options))
    correct_ans = [int]$q.($keys.correct_ans)
    images = @($q.($keys.images))
    page = $q.($keys.page)
  }
}

$json = @($payload) | ConvertTo-Json -Depth 6 -Compress

Write-Host "Uploading $($payload.Count) questions to $ApiUrl" -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType 'application/json; charset=utf-8' -Body $json

Write-Host "Import finished." -ForegroundColor Green
$response | ConvertTo-Json -Depth 6
