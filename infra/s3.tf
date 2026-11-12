
resource "aws_s3_bucket" "datapipe_bucket" {
  bucket        = "${var.project_name}-storage-bucket-${var.environment}-eu-west-1"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-s3-storage"
  }
}

resource "aws_s3_bucket_versioning" "bucket_versioning" {
  bucket = aws_s3_bucket.datapipe_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "public_block" {
  bucket                  = aws_s3_bucket.datapipe_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}