#!/bin/bash

BASEDIR=$(dirname $0)/..

source ${BASEDIR}/.env
sed "s/___CLIENTID___/${GOOGLE_CLIENTID}/" ${BASEDIR}/static/js/app.js.tmpl > ${BASEDIR}/static/js/app.js

sed "s/___SPOTIFY_USERNAME___/${SPOTIFY_USERNAME}/" ${BASEDIR}/mopidy.conf.tmpl | \
  sed "s/___SPOTIFY_PASSWORD___/${SPOTIFY_PASSWORD}/" | \
  sed "s/___SCROBBLER_USERNAME___/${SCROBBLER_USERNAME}/" | \
  sed "s/___SCROBBLER_PASSWORD___/${SCROBBLER_PASSWORD}/" > ${BASEDIR}/mopidy.conf
