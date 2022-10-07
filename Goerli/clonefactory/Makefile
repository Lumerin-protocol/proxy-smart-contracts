version := $(shell cat ./VERSION)

release-go:
	make release-git path="bindings-go" remote="git@github.com:Lumerin-protocol/clonefactory-go-bindings.git"
	echo "Go bindings released"

release-js:
	make release-git path="pkg/nodejs" remote="git@github.com:Lumerin-protocol/clonefactory-js-bindings.git"
	echo "JS bindings released"

release-git:
	cd $(path) \
		&& git init \
		&& git branch -m main \
		&& git config --local user.email "lumerin@titan.io" \
		&& git config --local user.name	"Lumerin Bot" \
		&& git remote add origin $(remote) \
		&& git add . \
		&& git commit -m "release: $(version)" \
		&& git fetch origin main \
		&& git merge origin/main --strategy=ours --allow-unrelated-histories -m "release: $(version)" \
		&& git tag -a v$(version) -m "release $(version)"\
		&& git push -u --tags --set-upstream origin main