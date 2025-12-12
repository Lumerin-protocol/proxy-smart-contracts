version := $(shell cat ./VERSION)

clean:
	rm -rf abi artifacts cache build-go build-js abi

test:
	kill "$$(lsof -t -i:8545)" || true
	make compile
	make -B build-js 
	yarn hardhat node & ./node-local-deploy.sh && yarn hardhat test --network localhost tests/localnode/*.ts
	kill "$$(lsof -t -i:8545)" || true

test-hardhat:
	yarn hardhat --network hardhat test $$(find ./tests/hardhatnode/ -type f -iname "*.test.ts")

test-hardhat-coverage:
	SOLIDITY_COVERAGE=true yarn hardhat coverage --testfiles "./tests/hardhatnode/**/*.test.ts"

.PHONY: coverage
coverage:
	open ./coverage/index.html

test-upgrade:
	yarn hardhat --network localhost test --bail tests/upgrades/*.ts 

compile:
	yarn hardhat compile

deploy-lumerin:
	yarn hardhat run --network default ./scripts/deploy-lumerin.ts

deploy-clonefactory:
	yarn hardhat run --network default ./scripts/deploy-clonefactory.ts

deploy-faucet:
	yarn hardhat run --network default ./scripts/deploy-faucet.ts

deploy-validator-registry:
	yarn hardhat run --network default ./scripts/deploy-validator-registry.ts

update-clonefactory:
	yarn hardhat run --network default ./scripts/update-clonefactory.ts

update-implementation:
	yarn hardhat run --network default ./scripts/update-implementation.ts

update-validator-registry:
	yarn hardhat run --network default ./scripts/update-validator-registry.ts

populate-contracts:
	yarn hardhat run --network default ./scripts/populate-contracts.ts

build-go:
	./build-go.sh

build-js:
	./build-js.sh

release-go:
	make release-git path="build-go" remote="git@github.com:Lumerin-protocol/contracts-go.git"
	echo "contracts-go released"

release-js:
	cd build-js && yarn version --new-version $(version) --no-git-tag-version
	make release-git path="build-js" remote="git@github.com:Lumerin-protocol/contracts-js.git"
	echo "contracts-js released"


release-git:
	cd $(path) \
		&& rm -rf .git \
		&& git init \
		&& git checkout -b main \
		&& git config --local user.email "lumerin@titan.io" \
		&& git config --local user.name	"Lumerin Bot" \
		&& git remote add origin $(remote) \
		&& git add . \
		&& git commit -m "release: $(version)" \
		&& git fetch origin main \
		&& git merge origin/main --strategy=ours --allow-unrelated-histories -m "release: $(version)" \
		&& git tag -a v$(version) -m "release $(version)"\
		&& git push -u --tags --set-upstream origin main
	
node-local:
	yarn hardhat node

deploy-local:
	yarn hardhat run ./scripts/deploy-local.ts

node-local-update:
	./node-local-update.sh

static-analysis:
	slither . --checklist --include-paths "contracts/validator-registry|contracts/marketplace"

static-analysis-aderyn:
	yarn run aderyn