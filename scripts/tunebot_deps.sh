# If we're running in Vagrant, symlink the shared directory to the standard
# tunebot installation path
if [ -d "/vagrant" ]; then
  ln -s /vagrant /opt/tunebot
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update --yes

# Install node on Raspbian
# wget http://node-arm.herokuapp.com/node_latest_armhf.deb
# sudo dpkg -i node_latest_armhf.deb

apt-get install curl python python-pip nodejs npm redis-server libmysqlclient-dev runit --yes

# Link the nodejs executable to the name that every fucking package in NPM
# expects. Debian packagers are just constantly trolling the world, right?
ln -s /usr/bin/nodejs /usr/bin/node

curl https://apt.mopidy.com/mopidy.gpg 2>/dev/null | sudo apt-key add -
curl https://apt.mopidy.com/mopidy.list 2>/dev/null > /etc/apt/sources.list.d/mopidy.list
apt-get update --yes
apt-get install mopidy mopidy-spotify mopidy-scrobbler --yes

cd /opt/tunebot && npm install
cd /opt/tunebot && ./scripts/build_templates.sh

npm install nodemon -g

# We're going to run these via runit, so make sure the stock init doesn't.
service mopidy stop
service redis-server stop
update-rc.d -f mopidy remove
update-rc.d -f redis-server remove

mkdir /var/log/tunebot

mkdir /var/service
cp -Rp /opt/tunebot/svc/* /var/service/
chown -R root:root /var/service
ln -s /var/service/* /etc/service/
