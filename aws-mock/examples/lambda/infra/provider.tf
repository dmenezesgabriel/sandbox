provider "aws" {
  region                      = "us-east-1"
  access_key                  = "dummy"
  secret_key                  = "dummy"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    s3     = "http://localstack:4566"
    lambda = "http://localstack:4566"
    iam    = "http://localstack:4566"
  }
}
