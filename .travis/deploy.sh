#!/bin/bash -e

source .travis/functions.sh

if [ "${SKIP_BUILD}" != "1" ]; then
    _build_package || _exit_error "error in build stage"
fi

if [ "$TRAVIS_REPO_SLUG" = "Midburn/spark" ]; then
	echo "An official repository, yey!"
	if [ -n "${SPARK_DEPLOYMENT_KEY}" ]; then
		if [ "$TRAVIS_BRANCH" = "master" ]; then
			echo "Deploying to staging server from $TRAVIS_BRANCH branch"
			echo -e ${SPARK_DEPLOYMENT_KEY} | base64 -d > stage_machine.key
			chmod 400 stage_machine.key
			scp -o StrictHostKeyChecking=no -i stage_machine.key `_get_deployment_package_filename` "${SPARK_DEPLOYMENT_HOST}:/opt/spark/package.tar.gz" &&
			  ssh -o StrictHostKeyChecking=no -i stage_machine.key ${SPARK_DEPLOYMENT_HOST} "/opt/spark/deploy.sh"
			RC=$?
			rm -f stage_machine.key
			if [ $RC -eq 0 ]; then
				_exit_success "deployment completed successfully"
			else
				_exit_error "deployment failed"
			fi
		else
			echo "We don't deploy from $TRAVIS_BRANCH"
		fi
	else
		echo "Can't find deployment SSH key"
	fi
else
	echo "Not the oficial repository, not deploying"
fi
