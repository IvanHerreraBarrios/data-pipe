terraform {
  backend "s3" {
    bucket = "backend-data-pipe-127621463335-eu-west-1-an"
    key    = "datapipe/terraform.tfstate"
    region = "eu-west-1"
    encrypt = true
  }
}