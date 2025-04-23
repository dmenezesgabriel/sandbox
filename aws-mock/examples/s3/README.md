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
docker compose run --rm awscli s3 cp s3://my-test-bucket/file.txt -
```
