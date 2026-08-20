$key = (Get-Content "C:\Users\chuwe\Documents\Garden_Stroll\.env.local" | Where-Object { $_ -match '^DEEPSEEK_API_KEY=' } | Select-Object -First 1) -replace '^DEEPSEEK_API_KEY=', ''
Write-Output "=== Test 1: with thinking disabled ==="
try {
  $body = @{ model = "deepseek-v4-flash"; messages = @(@{ role = "user"; content = "hello" }); max_tokens = 10; thinking = @{ type = "disabled" } } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method POST -Headers @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" } -Body $body -TimeoutSec 20 -ErrorAction Stop
  Write-Output ("OK: " + $resp.choices[0].message.content)
} catch {
  Write-Output ("FAIL: " + $_.Exception.Message)
  if ($_.ErrorDetails.Message) { Write-Output ("BODY: " + $_.ErrorDetails.Message) }
}
Write-Output "=== Test 2: with response_format json_object ==="
try {
  $content = [string]::Format("{0}intent{0}:{0}smalltalk{0}{1}", [char]34, [char]125)
  $content = [string]::Format("{0}intent{0}:{0}smalltalk{0}", [char]34) + [char]125
  $body = @{ model = "deepseek-v4-flash"; messages = @(@{ role = "user"; content = $content }); max_tokens = 10; response_format = @{ type = "json_object" } } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method POST -Headers @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" } -Body $body -TimeoutSec 20 -ErrorAction Stop
  Write-Output ("OK: " + $resp.choices[0].message.content)
} catch {
  Write-Output ("FAIL: " + $_.Exception.Message)
  if ($_.ErrorDetails.Message) { Write-Output ("BODY: " + $_.ErrorDetails.Message) }
}