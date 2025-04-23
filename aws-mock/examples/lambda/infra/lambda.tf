data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../handler.js"
  output_path = "${path.module}/../node-lambda.zip"
}

resource "aws_s3_bucket" "lambda_bucket" {
  bucket = "lambda-functions"
}

resource "aws_s3_object" "lambda_zip" {
  bucket = aws_s3_bucket.lambda_bucket.id
  key    = "node-lambda.zip"
  source = data.archive_file.lambda_zip.output_path
  etag   = filemd5(data.archive_file.lambda_zip.output_path)
}

resource "aws_iam_role" "lambda_exec_role" {
  name = "lambda_exec_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Principal = {
        Service = "lambda.amazonaws.com"
      },
      Effect = "Allow",
      Sid    = ""
    }]
  })
}

resource "aws_lambda_function" "my_lambda" {
  function_name = "hello-lambda"
  s3_bucket     = aws_s3_object.lambda_zip.bucket
  s3_key        = aws_s3_object.lambda_zip.key
  handler       = "handler.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn
}
