version := $(shell cat ./VERSION)

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