resource "aws_apigatewayv2_api" "http_api" {
  name          = "hello-http-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_route" "hello_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /hello"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_integration.id}"
}

resource "aws_apigatewayv2_integration" "lambda_integration" {
  api_id             = aws_apigatewayv2_api.http_api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.main.invoke_arn
  integration_method = "POST"
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

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
