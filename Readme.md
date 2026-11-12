# Introducción

Data-pipe: Sistema de exporte
de JSON.
El usuario sube .json como
el siguiente formato:
Nota: Cada Json debe tener batchId único.
Si no es único, el sistema lo contará 
duplicado; y lo rechazará.

```typescript
{
    "batchId": "batch-test-alarm-sample9",
        "records": [
        {
            "email": "carlos.mendoza@empresa.com",
            "category": "Finance",
            "amount": 150
        },
        {
            "email": "ana.gomez@techsolution.net",
            "category": "Tech",
            "amount": 320
        },
        {
            "email": "soporte_global@cloud.org",
            "category": "Support",
            "amount": 95
        },
        {
            "email": "ventas.latam@tienda.io",
            "category": "Sales",
            "amount": 540
        },
        {
            "email": "laura.perez@startup.co",
            "category": "HR",
            "amount": 210
        },
        {
            "email": "finanzas@corporativo.es",
            "category": "Finance",
            "amount": 1250
        },
        {
            "email": "david.ruiz@innovacion.net",
            "category": "Tech",
            "amount": 430
        },
        {
            "email": "contacto.cliente@portal.org",
            "category": "Sales",
            "amount": 670
        },
        {
            "email": "admin.sistema@servers.io",
            "category": "Support",
            "amount": 180
        },
        {
            "email": "correo-sin-arroba.com",
            "category": "Finance",
            "amount": 50
        },
        {
            "email": "usuario@sin-dominio",
            "category": "Tech",
            "amount": 75
        },
        {
            "email": "@dominio-faltante.com",
            "category": "Sales",
            "amount": 100
        },
        {
            "email": "doble@@arroba.com",
            "category": "HR",
            "amount": 120
        },
        {
            "email": "espacios en blanco@correo.com",
            "category": "Finance",
            "amount": 200
        },
        {
            "email": "punto.final.@dominio.com",
            "category": "Tech",
            "amount": 150
        },
        {
            "email": "usuario..doblepunto@dominio.com",
            "category": "Support",
            "amount": 80
        },
        {
            "email": "caracteres$raros#@dominio.com",
            "category": "Sales",
            "amount": 90
        },
        {
            "email": "sin-usuario@.com",
            "category": "HR",
            "amount": 110
        },
        {
            "email": "otro.correo.invalido@",
            "category": "Finance",
            "amount": 60
        },
        {
            "email": "prueba..test@dominio..com",
            "category": "Tech",
            "amount": 130
        }
    ]
}
```

Se verifica que el
email tiene formato válido.
 
Al finalizar el proceso,
se te permite descargar el reporte pdf; y un json con correcciones.
Además, si se pasa un
umbral de x errores en email; se le notifica al desarrollador por email.
 


# Arquitectura

# Arquitectura

## Serverless Puro

Ofrecía mejor desacoplamiento y escalabilidad horizontal más rápida. Además, las tareas eran cortas y podían morir de manera grácil. Adicionalmente, se usó DynamoDB ya que ofrece respuestas en milisegundos.

Para el frontend se usó CloudFront para aprovechar las ventajas de las Edge Locations.

### API Gateway

-> /get-upload-url  Devuelve URI firmada de S3 para poder subir archivos .json

->  /validate       Revisa que los .json no sean duplicados

->   /imports      Listado por usuario de: sus archivos y filas procesadas (success/failed) con su mensaje

->  /imports/{batchId}/export    Descarga de .json de errores y de reportes en PDF

### AWS Cognito

Servicio de AWS que cuenta con /login y /register para autenticación de usuarios.

### Otros:

SQS-Splitter -> Es una cola donde se guardan eventos PUT a S3. Al detectar una subida de archivo se encola el evento para llamar a la Lambda Splitter.

Lambda-splitter -> Se activa al detectar eventos en SQS-Splitter. Revisa la ruta de S3, que viene en el evento, y procesa las filas del JSON en un lote de 10 en 10 para encolarlas en SQS Worker.

SQS-Worker -> Recibe los lotes de 10 en 10.

Lambda-Worker -> Se activa al detectar movimiento en SQS-Worker. Recibe de 10 en 10 los lotes. Aplica validación de correo electrónico correcto. Si todo ocurre bien se guarda como success, si no, se guarda como failed con su motivo.


```text
       +-------------------------------------------------------------+
       |                  CloudFront CDN (Frontend)                  |
       |              [https://d1isqst14dnfdh.cloudfront.net](https://d1isqst14dnfdh.cloudfront.net)          |
       +------------------------------+------------------------------+
                                      | (HTTPS / JWT Auth)
                                      v
+------------------+       +---------------------+       +---------------------+
|   AWS Cognito    |------>|  API Gateway (HTTP) |------>| Lambda (Upload /    |
|  User Pool & ID  |       |  /get-upload-url    |       |   Status / Export)  |
+------------------+       +----------+----------+       +----------+----------+
                                      |                             |
                                      | (Presigned URL PUT)         | (Lectura/Escritura)
                                      v                             v
                           +---------------------+       +---------------------+
                           |    S3 Storage       |------>|     DynamoDB        |
                           |   (Sube JSON)       | SQS   |  (Control de Lotes) |
                           +----------+----------+       +---------------------+
                                      | (S3 Event Notification)
                                      v
                           +---------------------+       +---------------------+
                           |   SQS (Splitter)    |------>|  Lambda (Splitter)  |
                           +---------------------+       +---------------------+
                                                                    |
                                                                    v
                                                         +---------------------+
                                                         |   SQS (Workers)     |-----> [Workers Lambda]
```
# Instrucciones despliegue

Prerrequisitos
Cuenta de AWS con permisos administrativos o de laboratorio.

Terraform instalado (v1.5+).

Node.js (v18+) y NPM instalados.

AWS CLI configurado en tu entorno local (aws configure).




## Backend 
Puedes empaquetar todas las funciones Lambda de forma automatizada ejecutando el script de PowerShell en la raíz del proyecto:
```bash
.\build-lambdas.ps1
```

## Terraform
Generar un bucket backend en la interfaz de AWS y poner en caliente la ruta en infra/backend.tf
```terraform
terraform {
  backend "s3" {
    bucket = "AQUI VA LA RUTA"
    key    = "datapipe/terraform.tfstate"
    region = "eu-west-1"
    encrypt = true
  }
}
```

Primero, aprovisionaremos todos los recursos base en AWS (S3, DynamoDB, API Gateway, Cognito, SQS y CloudFront).

```bash
cd infra
terraform init
terraform apply
```
Guarda los outputs generados al finalizar (api_endpoint, cognito_user_pool_id, cognito_app_client_id, etc.), ya que los necesitarás para el frontend.

## Frontend
Necesitarás ir a la carpeta src/environments y modificar environments.prod.ts / environment.ts.
Aquí usarás los outputs que dio Terraform.

Puedes ponerlos en caliente o generar un archivo .env.production al mismo nivel que package.json:
```typescript 
NG_APP_API_URL=Output-terraform
NG_APP_COGNITO_REGION=eu-west-1
NG_APP_COGNITO_USER_POOL_ID=Output-terraform
NG_APP_COGNITO_CLIENT_ID=Output-terraform

```

```typescript
export const environment = {
    production: true,
    apiUrl: import.meta.env['NG_APP_API_URL'] || '',
    cognito: {
        region: import.meta.env['NG_APP_COGNITO_REGION'] || '',
        userPoolId: import.meta.env['NG_APP_COGNITO_USER_POOL_ID'] || '',
        clientId: import.meta.env['NG_APP_COGNITO_CLIENT_ID'] || ''
    }
};
```

Navegar a frontend, buildear el forntend, push al bucket y borrar la cache.

```bash
cd frontend
npm run build -- --configuration production
aws s3 sync dist/frontend/browser RUTA_S3 --delete
aws cloudfront create-invalidation --distribution-id DISATRIBUTIONID--paths "/*"

```






# Instrucciones destrucción
Vaciar los buckets s3

```bash

aws s3 rm s3://datapipe-frontend-hosting-lab-eu-west-1 --recursive

aws s3 rm s3://datapipe-storage-lab --recursive
```

Destroy de components

```bash

cd infra
terraform destroy
```

# Coste mensual

| Servicio AWS | Uso Estimado | Coste Mensual Aprox. |
| :--- | :--- | :--- |
| **Amazon S3** | 5 GB almacenamiento / 1,000 PUT / 10,000 GET | \$0.15 USD |
| **API Gateway (HTTP)** | 10,000 solicitudes | \$0.01 USD |
| **AWS Lambda** | 7 funciones (1 GB RAM, 2 seg. promedio, 10k invocaciones) | \$0.20 USD |
| **Amazon SQS** | 20,000 mensajes procesados | \$0.00 (Capa Gratuita / Free Tier) |
| **Amazon DynamoDB** | 1 GB almacenamiento, modo On-Demand | \$0.25 USD |
| **CloudFront CDN** | 10 GB transferencia de datos | \$0.85 USD |
| **Amazon Cognito** | 50 usuarios activos mensuales (MAU) | \$0.00 (Gratis hasta 50k MAU) |
| **AWS Budgets** | Monitoreo y alertas de control | \$0.01 USD |
| **TOTAL ESTIMADO** | | **~ \$ 1.47 USD / mes** |


