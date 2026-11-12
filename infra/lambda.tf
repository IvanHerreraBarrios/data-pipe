# Rol IAM compartido
data "aws_iam_role" "lambda_exec" {
  name = "studentLambdaExecutionRole"
}

#Lambda cognito
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/email-lambda"
  output_path = "${path.module}/../backend/email-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "auto_confirm" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "datapipe-auto-confirm-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_lambda_alias" "auto_confirm_live" {
  name             = "live"
  function_name    = aws_lambda_function.auto_confirm.function_name
  function_version = "$LATEST"
}

resource "aws_lambda_permission" "allow_cognito" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auto_confirm.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.pool.arn
}

#Lambda upload
data "archive_file" "upload_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/upload-lambda"
  output_path = "${path.module}/../backend/upload-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "upload_processor" {
  filename         = data.archive_file.upload_lambda_zip.output_path
  function_name    = "datapipe-upload-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.upload_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.datapipe_storage.id
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.datapipe_table.name
    }
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_lambda_alias" "upload_processor_live" {
  name             = "live"
  function_name    = aws_lambda_function.upload_processor.function_name
  function_version = "$LATEST"
}

#lambda splitter
data "archive_file" "splitter_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/splitter-lambda"
  output_path = "${path.module}/../backend/splitter-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "splitter" {
  filename         = data.archive_file.splitter_lambda_zip.output_path
  function_name    = "datapipe-splitter-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.splitter_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      WORKERS_QUEUE_URL = aws_sqs_queue.workers_queue.url
    }
  }

  tags = {
    Name        = "datapipe-splitter"
    Environment = var.environment
    Project     = var.project_name
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_lambda_alias" "splitter_live" {
  name             = "live"
  function_name    = aws_lambda_function.splitter.function_name
  function_version = "$LATEST"
}

resource "aws_lambda_event_source_mapping" "splitter_sqs_trigger" {
  event_source_arn  = aws_sqs_queue.splitter_queue.arn
  function_name     = aws_lambda_function.splitter.arn
  batch_size        = 1
  enabled           = true
}

#Lambda worker
data "archive_file" "worker_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/worker-lambda"
  output_path = "${path.module}/../backend/worker-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "worker" {
  filename         = data.archive_file.worker_lambda_zip.output_path
  function_name    = "datapipe-worker-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.worker_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      DYNAMODB_TABLE_NAME    = aws_dynamodb_table.datapipe_table.name
    }
  }

  tags = {
    Name        = "datapipe-worker"
    Environment = var.environment
    Project     = var.project_name
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_lambda_alias" "worker_live" {
  name             = "live"
  function_name    = aws_lambda_function.worker.function_name
  function_version = "$LATEST"
}

resource "aws_lambda_event_source_mapping" "worker_sqs_trigger" {
  event_source_arn  = aws_sqs_queue.workers_queue.arn
  function_name     = aws_lambda_function.worker.arn
  batch_size        = 1
  enabled           = true
}

#Lambda status polling
data "archive_file" "status_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/status-lambda"
  output_path = "${path.module}/../backend/status-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "status_processor" {
  filename         = data.archive_file.status_lambda_zip.output_path
  function_name    = "datapipe-status-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.status_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.datapipe_table.name
    }
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_lambda_alias" "status_processor_live" {
  name             = "live"
  function_name    = aws_lambda_function.status_processor.function_name
  function_version = "$LATEST"
}

# Download Lambda
data "archive_file" "download_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/download-lambda"
  output_path = "${path.module}/../backend/download-lambda/download-lambda.zip"
}

resource "aws_lambda_function" "download" {
  filename         = data.archive_file.download_lambda_zip.output_path
  function_name    = "datapipe-download-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.download_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.datapipe_table.name
      BUCKET_NAME         = aws_s3_bucket.datapipe_storage.id
    }
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_lambda_alias" "download_live" {
  name             = "live"
  function_name    = aws_lambda_function.download.function_name
  function_version = "$LATEST"
}

#Lambda validador
data "archive_file" "validator_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/validator-lambda"
  output_path = "${path.module}/../backend/validator-lambda/validator-lambda.zip"
}

resource "aws_lambda_function" "validator" {
  filename         = data.archive_file.validator_lambda_zip.output_path
  function_name    = "datapipe-validator-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.validator_lambda_zip.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.datapipe_storage.id
    }
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

resource "aws_lambda_alias" "validator_live" {
  name             = "live"
  function_name    = aws_lambda_function.validator.function_name
  function_version = "$LATEST"
}

/*# Rol IAM compartido
data "aws_iam_role" "lambda_exec" {
  name = "studentLambdaExecutionRole"
}

#Lambda cognito
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/email-lambda"
  output_path = "${path.module}/../backend/email-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "auto_confirm" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = "datapipe-auto-confirm-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  # lifecycle {
  #   ignore_changes = [
  #     filename,
  #     source_code_hash,
  #     last_modified
  #   ]
  # }
}

resource "aws_lambda_alias" "auto_confirm_live" {
  name             = "live"
  function_name    = aws_lambda_function.auto_confirm.function_name
  function_version = "$LATEST"
}

resource "aws_lambda_permission" "allow_cognito" {
  statement_id  = "AllowExecutionFromCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auto_confirm.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.pool.arn
}

#Lambda upload
data "archive_file" "upload_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/upload-lambda"
  output_path = "${path.module}/../backend/upload-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "upload_processor" {
  filename         = data.archive_file.upload_lambda_zip.output_path
  function_name    = "datapipe-upload-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.upload_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.datapipe_storage.id
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.datapipe_table.name
    }
  }

  # lifecycle {
  #   ignore_changes = [
  #     filename,
  #     source_code_hash,
  #     last_modified
  #   ]
  # }
}

resource "aws_lambda_alias" "upload_processor_live" {
  name             = "live"
  function_name    = aws_lambda_function.upload_processor.function_name
  function_version = "$LATEST"
}

#lambda splitter
data "archive_file" "splitter_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/splitter-lambda"
  output_path = "${path.module}/../backend/splitter-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "splitter" {
  filename         = data.archive_file.splitter_lambda_zip.output_path
  function_name    = "datapipe-splitter-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.splitter_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      WORKERS_QUEUE_URL = aws_sqs_queue.workers_queue.url
    }
  }

  tags = {
    Name        = "datapipe-splitter"
    Environment = var.environment
    Project     = var.project_name
  }

  # lifecycle {
  #   ignore_changes = [
  #     filename,
  #     source_code_hash,
  #     last_modified
  #   ]
  # }
}

resource "aws_lambda_alias" "splitter_live" {
  name             = "live"
  function_name    = aws_lambda_function.splitter.function_name
  function_version = "$LATEST"
}

resource "aws_lambda_event_source_mapping" "splitter_sqs_trigger" {
  event_source_arn  = aws_sqs_queue.splitter_queue.arn
  function_name     = aws_lambda_function.splitter.arn
  batch_size        = 1
  enabled           = true
}

#Lambda worker
data "archive_file" "worker_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/worker-lambda"
  output_path = "${path.module}/../backend/worker-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "worker" {
  filename         = data.archive_file.worker_lambda_zip.output_path
  function_name    = "datapipe-worker-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.worker_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      DYNAMODB_TABLE_NAME    = aws_dynamodb_table.datapipe_table.name
    }
  }

  tags = {
    Name        = "datapipe-worker"
    Environment = var.environment
    Project     = var.project_name
  }

  # lifecycle {
  #   ignore_changes = [
  #     filename,
  #     source_code_hash,
  #     last_modified
  #   ]
  # }
}

resource "aws_lambda_alias" "worker_live" {
  name             = "live"
  function_name    = aws_lambda_function.worker.function_name
  function_version = "$LATEST"
}

resource "aws_lambda_event_source_mapping" "worker_sqs_trigger" {
  event_source_arn  = aws_sqs_queue.workers_queue.arn
  function_name     = aws_lambda_function.worker.arn
  batch_size        = 1
  enabled           = true
}

#Lambda status polling
data "archive_file" "status_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/status-lambda"
  output_path = "${path.module}/../backend/status-lambda/lambda_function.zip"
}

resource "aws_lambda_function" "status_processor" {
  filename         = data.archive_file.status_lambda_zip.output_path
  function_name    = "datapipe-status-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.status_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.datapipe_table.name
    }
  }

  # lifecycle {
  #   ignore_changes = [
  #     filename,
  #     source_code_hash,
  #     last_modified
  #   ]
  # }
}

resource "aws_lambda_alias" "status_processor_live" {
  name             = "live"
  function_name    = aws_lambda_function.status_processor.function_name
  function_version = "$LATEST"
}

# Download Lambda
data "archive_file" "download_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/download-lambda"
  output_path = "${path.module}/../backend/download-lambda/download-lambda.zip"
}

resource "aws_lambda_function" "download" {
  filename         = data.archive_file.download_lambda_zip.output_path
  function_name    = "datapipe-download-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.download_lambda_zip.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.datapipe_table.name
      BUCKET_NAME         = aws_s3_bucket.datapipe_storage.id
    }
  }

  # lifecycle {
  #   ignore_changes = [
  #     filename,
  #     source_code_hash,
  #     last_modified
  #   ]
  # }
}

resource "aws_lambda_alias" "download_live" {
  name             = "live"
  function_name    = aws_lambda_function.download.function_name
  function_version = "$LATEST"
}

#Lambda validador
data "archive_file" "validator_lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/validator-lambda"
  output_path = "${path.module}/../backend/validator-lambda/validator-lambda.zip"
}

resource "aws_lambda_function" "validator" {
  filename         = data.archive_file.validator_lambda_zip.output_path
  function_name    = "datapipe-validator-${var.environment}"
  role             = data.aws_iam_role.lambda_exec.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.validator_lambda_zip.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME = aws_s3_bucket.datapipe_storage.id
    }
  }

  # lifecycle {
  #   ignore_changes = [
  #     filename,
  #     source_code_hash,
  #     last_modified
  #   ]
  # }
}

resource "aws_lambda_alias" "validator_live" {
  name             = "live"
  function_name    = aws_lambda_function.validator.function_name
  function_version = "$LATEST"
}
*/