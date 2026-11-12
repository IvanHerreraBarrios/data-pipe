#Cola y DLQ para splitter

resource "aws_sqs_queue" "splitter_dlq" {
  name = "datapipe-splitter-dlq-${var.environment}"

  tags = {
    Name        = "datapipe-splitter-dlq"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_sqs_queue" "splitter_queue" {
  name                       = "datapipe-splitter-queue-${var.environment}"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400 # 1 día

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.splitter_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "datapipe-splitter-queue"
    Environment = var.environment
    Project     = var.project_name
  }
}

# cola y dlq para workers finales

resource "aws_sqs_queue" "workers_dlq" {
  name = "datapipe-workers-dlq-${var.environment}"

  tags = {
    Name        = "datapipe-workers-dlq"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_sqs_queue" "workers_queue" {
  name                       = "datapipe-workers-queue-${var.environment}"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600 # 4 días

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.workers_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "datapipe-workers-queue"
    Environment = var.environment
    Project     = var.project_name
  }
}



