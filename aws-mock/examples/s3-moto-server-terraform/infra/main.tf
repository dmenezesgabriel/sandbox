provider "aws" {
  region                      = "us-east-1"
  access_key                  = "dummy"
  secret_key                  = "dummy"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    s3 = "http://moto:5000"
  }
}

resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-test-bucket"
}

resource "aws_s3_object" "my_file" {
  bucket       = aws_s3_bucket.my_bucket.id
  key          = "file.txt"
  content      = "hello"
  content_type = "text/plain"
}
