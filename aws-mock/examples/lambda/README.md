```sh
docker compose up moto
```

```sh
docker compose run --rm -v $PWD:$PWD -w $PWD/infra terraform init
```

```sh
docker compose run --rm -v $PWD:$PWD -w $PWD/infra terraform apply --auto-approve
```

```sh
docker compose run --rm  awscli s3 ls
```

```sh
docker compose run --rm awscli lambda invoke --function-name hello-lambda out.json
```

```sh
docker run --rm \
  -v "$PWD":/var/task \
  mlupin/docker-lambda:nodejs18.x \
  handler.handler '{"key": "value"}'
```
