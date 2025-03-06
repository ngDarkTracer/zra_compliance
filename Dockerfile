FROM ubuntu:latest
LABEL authors="pro"

ENTRYPOINT ["top", "-b"]