Import-Module PSWSMan -ErrorAction SilentlyContinue
Write-Output "PSWSMan loaded"
$pass = ConvertTo-SecureString 'Azerty1234@' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('Administrateur', $pass)
# Test 1: HTTP port 5985 (AllowUnencrypted=true, Basic auth)
try {
  $r = Invoke-Command -ComputerName 192.168.23.145 -Port 5985 -Credential $cred -Authentication Basic -ScriptBlock { hostname } -ErrorAction Stop
  Write-Output "SUCCESS HTTP: $r"
} catch {
  Write-Output "ERROR HTTP: $($_.Exception.Message)"
}
# Test 2: HTTPS port 5986 avec SkipCACheck/SkipCNCheck
try {
  $so = New-PSSessionOption -SkipCACheck -SkipCNCheck -OperationTimeout 15000
  $r2 = Invoke-Command -ComputerName 192.168.23.145 -UseSSL -Port 5986 -Credential $cred -Authentication Basic -SessionOption $so -ScriptBlock { hostname } -ErrorAction Stop
  Write-Output "SUCCESS HTTPS: $r2"
} catch {
  Write-Output "ERROR HTTPS: $($_.Exception.Message)"
}
