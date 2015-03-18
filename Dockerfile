FROM ubuntu:14.04
MAINTAINER JD Harrington <jd@nextbigsound.com>

ADD . /opt/tunebot
RUN /bin/bash /opt/tunebot/scripts/tunebot_deps.sh
EXPOSE 80
ENTRYPOINT ["/usr/sbin/runsvdir-start"]
