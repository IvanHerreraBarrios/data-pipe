output "dynamodb_table_name" {
  value       = aws_dynamodb_table.datapipe_table.name
  description = "Nombre de la tabla principal en DynamoDB"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.datapipe_bucket.id
  description = "Nombre del bucket S3 de almacenamiento"
}

output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.pool.id
  description = "ID del User Pool de Cognito"
}

output "cognito_app_client_id" {
  value       = aws_cognito_user_pool_client.client.id
  description = "ID del App Client de Cognito"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.cdn.id
  description = "ID de la distribucion de CloudFront para invalidaciones"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.cdn.domain_name
  description = "URL pública de CloudFront"
}

output "frontend_s3_bucket" {
  value       = aws_s3_bucket.frontend_bucket.id
  description = "Nombre del bucket del Frontend"
}

output "api_endpoint" {
  value       = aws_apigatewayv2_api.datapipe_api.api_endpoint
  description = "Endpoint del API Gateway"
}

output "splitter_queue_url" {
  value       = aws_sqs_queue.splitter_queue.url
  description = "URL de la cola SQS de entrada para el Splitter"
}

output "workers_queue_url" {
  value       = aws_sqs_queue.workers_queue.url
  description = "URL de la cola SQS de workers"
}

output "status_endpoint" {
  description = "Endpoint para consultar el estado de las importaciones (Polling)"
  value       = "${aws_apigatewayv2_api.datapipe_api.api_endpoint}/imports"
}