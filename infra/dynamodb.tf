# infra/dynamodb.tf

resource "aws_dynamodb_table" "datapipe_table" {
  name         = "${var.project_name}-table-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "GSI_PK"
    type = "S"
  }

  attribute {
    name = "GSI_SK"
    type = "S"
  }

  global_secondary_index {
    name            = "UserImportsIndex"
    hash_key        = "GSI_PK"
    range_key       = "GSI_SK"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-dynamodb-table"
  }
}