version := $(shell cat ./VERSION)

clean:
	rm -rf abi artifacts cache bindings-go bindings-js

test:
	yarn hardhat node & yarn hardhat test --network hardhat tests/*.js

compile:
	yarn hardhat compile

deploy-lumerin:
	yarn hardhat run --network goerli ./scripts/deploy-lumerin.js

deploy-clonefactory:
	yarn hardhat run --network goerli ./scripts/deploy-clonefactory.js

deploy-faucet:
	yarn hardhat run --network goerli ./scripts/deploy-faucet.js

populate-contracts:
	hardhat run --network goerli ./scripts/populate-contracts.js

build-go:
	./build-go.sh

build-js:
	./build-js.sh

release-go:
	make release-git path="bindings-go" remote="git@github.com:Lumerin-protocol/contracts-go.git"
	echo "contracts-go released"

release-js:
	cd bindings-js && yarn version --new-version $(version) --no-git-tag-version
	make release-git path="bindings-js" remote="git@github.com:Lumerin-protocol/contracts-js.git"
	echo "contracts-js released"

# release-js-npm:
# 	./templates/js/release.sh $(version) $(token)

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