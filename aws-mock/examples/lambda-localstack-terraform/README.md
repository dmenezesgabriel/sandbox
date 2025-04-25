1. Run localstack

```sh
docker compose up localstack
```

2. Init terraform

```sh
docker compose run --rm -v $PWD:$PWD -w $PWD/infra terraform init
```

3. Apply terraform

```sh
docker compose run --rm -v $PWD:$PWD -w $PWD/infra terraform apply --auto-approve
```

4. List created lambda functions

```sh
docker compose run --rm awscli lambda list-functions \
  --endpoint-url http://localstack:4566
```

5. List created bucket for storing lambda zip

```sh
docker compose run --rm  awscli s3 ls \
    --endpoint-url http://localstack:4566
```

6. Invoke function

```sh
docker compose run --rm awscli lambda invoke \
  --endpoint-url http://localstack:4566 \
  --function-name hello-lambda \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /dev/stdout
```

7. Get logs

```sh
docker compose run --rm awscli logs filter-log-events \
  --log-group-name /aws/lambda/hello-lambda \
  --endpoint-url http://localstack:4566 \
  --query 'events[].message' \
  --output text
```

```sh
docker run --rm \
  -v "$PWD":/var/task \
  mlupin/docker-lambda:nodejs18.x \
  handler.handler
```
