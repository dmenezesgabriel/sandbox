#!/bin/sh
# Install jq
yum install -y jq

# Run the default entrypoint of amazon/aws-cli
exec "$@"