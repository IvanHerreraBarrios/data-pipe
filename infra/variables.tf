
variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "project_name" {
  type    = string
  default = "datapipe"
}

variable "environment" {
  type    = string
  default = "lab"
}

variable "owner" {
  type    = string
  default = "John Doe en variables.tf"
}

variable "alert_email" {
  type    = string
  default = "vacio en variables.tf"
}