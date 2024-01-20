version := $(shell cat ./VERSION)

clean:
	rm -rf abi artifacts cache build-go build-js

test:
	kill "$$(lsof -t -i:8545)" || true
	make compile
	make -B build-js 
	yarn hardhat node --config hardhat-base.config.js & ./node-local-deploy.sh && yarn hardhat test --network localhost --config hardhat-base.config.js tests/*.js
	kill "$$(lsof -t -i:8545)" || true

test-upgrade:
	yarn hardhat --network localhost --config hardhat-base.config.js test --bail tests/upgrades/*.js 

compile:
	yarn hardhat compile --config hardhat-base.config.js

deploy-lumerin:
	yarn hardhat run --network default ./scripts/deploy-lumerin.js

deploy-clonefactory:
	yarn hardhat run --network default ./scripts/deploy-clonefactory.js

deploy-faucet:
	yarn hardhat run --network default ./scripts/deploy-faucet.js

update-clonefactory:
	yarn hardhat run --network default ./scripts/update-clonefactory.js

update-implementation:
	yarn hardhat run --network default ./scripts/update-implementation.js

populate-contracts:
	yarn hardhat run --network default ./scripts/populate-contracts.js

whitelist-clonefactory:
	yarn hardhat run --network default ./scripts/whitelist-clonefactory.js

set-fee-recipient:
	yarn hardhat run --network default ./scripts/set-feeRecipient.js

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

update-public-contracts:
	make release-git path="contracts" remote="git@github.com:Lumerin-protocol/smart-contracts.git"
	echo "smart-contracts released"

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
	
node-local:
	yarn hardhat node --config hardhat-base.config.js

node-local-deploy:
	./node-local-deploy.sh