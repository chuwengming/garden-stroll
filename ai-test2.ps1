$key = (Get-Content "C:\Users\chuwe\Documents\Garden_Stroll\.env.local" | Where-Object { $_ -match '^DEEPSEEK_API_KEY=' } | Select-Object -First 1) -replace '^DEEPSEEK_API_KEY=', ''
Write-Output "=== Test 3: full production params (json + thinking + json word in prompt) ==="
try {
  $prompt = "你是一個 LINE 美髮預約客服的意圖分類器。將使用者訊息分類為以下 JSON 之一（只輸出 json）：{ \"intent\":\"booking\"|\"product\"|\"smalltalk\"|\"cancel\"|\"amend\" }"
  $body = @{ model = "deepseek-v4-flash"; messages = @(@{ role = "user"; content = $prompt }); temperature = 0.4; max_tokens = 1000; response_format = @{ type = "json_object" }; thinking = @{ type = "disabled" } } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method POST -Headers @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" } -Body $body -TimeoutSec 30 -ErrorAction Stop
  Write-Output ("OK: " + $resp.choices[0].message.content)
} catch {
  Write-Output ("FAIL: " + $_.Exception.Message)
  if ($_.ErrorDetails.Message) { Write-Output ("BODY: " + $_.ErrorDetails.Message) }
}
Write-Output "=== Test 4: reply params (thinking disabled only) ==="
try {
  $msg = @(@{ role = "system"; content = "你是客服" }, @{ role = "user"; content = "你好" })
  $body = @{ model = "deepseek-v4-flash"; messages = $msg; temperature = 0.4; max_tokens = 1000; thinking = @{ type = "disabled" } } | ConvertTo-Json -Depth 6
  $resp = Invoke-RestMethod -Uri "https://api.deepseek.com/chat/completions" -Method POST -Headers @{ Authorization = "Bearer $key"; "Content-Type" = "application/json" } -Body $body -TimeoutSec 30 -ErrorAction Stop
  Write-Output ("OK: " + $resp.choices[0].message.content)
} catch {
  Write-Output ("FAIL: " + $_.Exception.Message)
  if ($_.ErrorDetails.Message) { Write-Output ("BODY: " + $_.ErrorDetails.Message) }
}