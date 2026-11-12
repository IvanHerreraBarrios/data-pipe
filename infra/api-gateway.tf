# API Gateway HTTP API con configuración global de CORS
resource "aws_apigatewayv2_api" "datapipe_api" {
  name          = "datapipe-api-${var.environment}"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins  = [#"https://d1gm7rnm7v98wk.cloudfront.net",
    "https://${aws_cloudfront_distribution.cdn.domain_name}",
    "http://localhost:4200"]
    allow_methods  = ["POST", "OPTIONS", "GET", "PUT", "DELETE"]
    allow_headers  = ["authorization", "content-type", "x-amz-date", "x-amz-security-token", "x-requested-with"]
    expose_headers = ["etag"]
    max_age        = 300
  }
}

#  Stage por defecto ($default)
resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.datapipe_api.id
  name        = "$default"
  auto_deploy = true
}

# Autorizador de Cognito para el API Gateway
resource "aws_apigatewayv2_authorizer" "cognito_auth" {
  api_id           = aws_apigatewayv2_api.datapipe_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer-${var.environment}"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"
  }
}

#  Integración de API Gateway con Lambda de subida
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id                 = aws_apigatewayv2_api.datapipe_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.upload_processor.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

#  Ruta POST protegida exclusivamente con Cognito
resource "aws_apigatewayv2_route" "upload_route_post" {
  api_id    = aws_apigatewayv2_api.datapipe_api.id
  route_key = "POST /get-upload-url"

  target = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

#  Ruta OPTIONS pública (authorization_type = "NONE") para que el preflight pase sin pedir token
resource "aws_apigatewayv2_route" "upload_route_options" {
  api_id             = aws_apigatewayv2_api.datapipe_api.id
  route_key          = "OPTIONS /get-upload-url"
  authorization_type = "NONE"
}

#  Permiso para que API Gateway pueda invocar Lambda upload
resource "aws_lambda_permission" "api_gateway_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload_processor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.datapipe_api.execution_arn}/*/*"
}


# Integración HTTP API con la Lambda de Status
resource "aws_apigatewayv2_integration" "status_lambda_integration" {
  api_id                 = aws_apigatewayv2_api.datapipe_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.status_processor.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Ruta GET protegida con Cognito para consultar el estado
resource "aws_apigatewayv2_route" "status_route_get" {
  api_id    = aws_apigatewayv2_api.datapipe_api.id
  route_key = "GET /imports"

  target = "integrations/${aws_apigatewayv2_integration.status_lambda_integration.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

# Permiso para que API Gateway pueda invocar la Lambda de Status
resource "aws_lambda_permission" "api_gateway_status_lambda" {
  statement_id  = "AllowExecutionFromAPIGatewayStatus"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.status_processor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.datapipe_api.execution_arn}/*/*"
}


# Permiso para que API Gateway HTTP API invoque esta Lambda
resource "aws_lambda_permission" "api_gateway_export" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.download.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.datapipe_api.execution_arn}/*/*"
}

# Integración HTTP API con la Lambda de exportación
resource "aws_apigatewayv2_integration" "export_integration" {
  api_id             = aws_apigatewayv2_api.datapipe_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.download.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

# Ruta GET para exportar el JSON de errores o el PDF (ej: /imports/{batchId}/export?type=json)
resource "aws_apigatewayv2_route" "get_export_route" {
  api_id    = aws_apigatewayv2_api.datapipe_api.id
  route_key = "GET /imports/{batchId}/export"
  target    = "integrations/${aws_apigatewayv2_integration.export_integration.id}"

  # Si ya usas el authorizer JWT de Cognito en tu API Gateway, puedes activarlo aquí:
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

#Lmabda validator
# Integración HTTP API con la Lambda Validator
resource "aws_apigatewayv2_integration" "validator_integration" {
  api_id                 = aws_apigatewayv2_api.datapipe_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.validator.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

#  Ruta POST /validate protegida exclusivamente con Cognito (JWT)
resource "aws_apigatewayv2_route" "validator_route_post" {
  api_id    = aws_apigatewayv2_api.datapipe_api.id
  route_key = "POST /validate"
  target    = "integrations/${aws_apigatewayv2_integration.validator_integration.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_auth.id
}

# Permiso para que API Gateway pueda invocar la Lambda Validator
resource "aws_lambda_permission" "api_gateway_validator_lambda" {
  statement_id  = "AllowExecutionFromAPIGatewayValidator"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.validator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.datapipe_api.execution_arn}/*/*"
}