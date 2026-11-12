#  Bucket de S3 para guardar los JSONs
resource "aws_s3_bucket" "datapipe_storage" {
  bucket = "${var.project_name}-storage-${var.environment}"

  tags = {
    Name = "${var.project_name}-storage"
  }
}
resource "aws_s3_bucket_cors_configuration" "storage_cors" {
  bucket = aws_s3_bucket.datapipe_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = [#"https://d1gm7rnm7v98wk.cloudfront.net",
     "https://${aws_cloudfront_distribution.cdn.domain_name}",
     "http://localhost:4200"]
    expose_headers  = ["ETag", "x-amz-server-side-encryption", "x-amz-request-id", "x-amz-id-2"]
    max_age_seconds = 300
  }
}

#  Política para permitir que S3 envíe mensajes a la cola SQS del Splitter
resource "aws_sqs_queue_policy" "splitter_queue_policy" {
  queue_url = aws_sqs_queue.splitter_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowS3ToSendMessageToSplitterQueue"
        Effect    = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.splitter_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_s3_bucket.datapipe_storage.arn
          }
        }
      }
    ]
  })
}

# 4. Configuración del evento del Bucket S3 apuntando a la cola SQS intermedia
resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.datapipe_storage.id

  queue {
    queue_arn     = aws_sqs_queue.splitter_queue.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "users/"
    filter_suffix = ".json"
  }

  depends_on = [aws_sqs_queue_policy.splitter_queue_policy]
}