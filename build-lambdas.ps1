$ErrorActionPreference = "Stop"

$lambdas = @(
    @{ Path = "backend/email-lambda";     ZipName = "lambda_function.zip" },
    @{ Path = "backend/upload-lambda";    ZipName = "lambda_function.zip" },
    @{ Path = "backend/splitter-lambda";  ZipName = "lambda_function.zip" },
    @{ Path = "backend/worker-lambda";    ZipName = "lambda_function.zip" },
    @{ Path = "backend/status-lambda";    ZipName = "lambda_function.zip" },
    @{ Path = "backend/download-lambda";  ZipName = "download-lambda.zip" },
    @{ Path = "backend/validator-lambda"; ZipName = "validator-lambda.zip" }
)

Write-Host "Iniciando el empaquetado automatico de funciones Lambda..." -ForegroundColor Cyan

foreach ($item in $lambdas) {
    $folder = $item.Path
    $zipName = $item.ZipName

    if (Test-Path $folder) {
        Write-Host "`n----------------------------------------"
        Write-Host "Procesando: $folder -> $zipName" -ForegroundColor Yellow

        Push-Location $folder

        if (Test-Path "package.json") {
            Write-Host "   -> Instalando dependencias..."
            npm ci --omit=dev --silent
            if ($LASTEXITCODE -ne 0) {
                npm install --production --silent
            }
        }

        if (Test-Path $zipName) {
            Remove-Item $zipName -Force
        }

        Write-Host "   -> Comprimiendo en $zipName..."
        Compress-Archive -Path * -DestinationPath $zipName -Force

        Pop-Location
        Write-Host "   [EXITO] Empaquetado correctamente." -ForegroundColor Green
    } else {
        Write-Host "   [AVISO] No se encontro la ruta $folder, se omite." -ForegroundColor DarkYellow
    }
}

Write-Host "`nTodas las funciones Lambda han sido empaquetadas con exito!" -ForegroundColor Cyan