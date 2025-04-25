# Create the Lambda ZIP
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../index.js"
  output_path = "${path.module}/../node-lambda.zip"
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_exec_role" {
  name = "lambda_execution_role"

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

# CloudWatch logging permissions
resource "aws_iam_role_policy" "lambda_logging" {
  name = "lambda-logging"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      Resource = "*"
    }]
  })
}

# Lambda function definition
resource "aws_lambda_function" "main" {
  function_name = "hello-lambda"
  filename      = "${path.module}/../node-lambda.zip"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn
}

# Create an HTTP API using API Gateway v2
resource "aws_apigatewayv2_api" "http_api" {
  name          = "hello-http-api"
  protocol_type = "HTTP"
}

# Create a route in the HTTP API
resource "aws_apigatewayv2_route" "hello_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /hello"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

# Create the Lambda integration for the HTTP API
resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.main.invoke_arn
  integration_method = "POST"
}

# Grant the API Gateway permission to invoke the Lambda function
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# Create a deployment for the HTTP API
resource "aws_apigatewayv2_deployment" "deploy" {
  api_id = aws_apigatewayv2_api.http_api.id

  triggers = {
    redeployment = sha1(jsonencode([aws_apigatewayv2_route.hello_route.id, aws_apigatewayv2_integration.lambda_integration.id]))
  }
}

resource "aws_apigatewayv2_stage" "dev" {
  name          = "dev"
  api_id        = aws_apigatewayv2_api.http_api.id
  deployment_id = aws_apigatewayv2_deployment.deploy.id
}
