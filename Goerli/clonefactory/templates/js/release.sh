#!/bin/sh

if [ -z "$1" ]; then 
  echo "version in not provided: example 'release.sh v0.0.1 NPM_TOKEN'"
  exit 1
fi

if [ -z "$2" ]; then 
  echo "token in not provided: example 'release.sh v0.0.1 NPM_TOKEN'"
  exit 1
fi

npm config set //registry.npmjs.org/:_authToken $2
yarn version --new-version $1 --no-git-tag-version
npm publish