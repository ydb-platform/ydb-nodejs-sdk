#!/bin/sh

package_version=`npm show . version`

cp -R certs build/src/
cat >build/package.json <<!EOF
{
    "version": "$package_version",
    "type": "commonjs"
}
!EOF
