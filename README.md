# Tunebot

## Configuration

Configuration of secrets is done via environment variables. Copy
`.env.sample` to `.env` and fill in appropriate values.

## Dependencies

Tunebot has two major external dependencies:

  - [Redis](http://redis.io/)
  - [Mopidy](https://www.mopidy.com/)
    - [Mopidy-Scrobbler](https://github.com/mopidy/mopidy-scrobbler)
    - [Mopidy-Spotify](https://github.com/mopidy/mopidy-spotify)

It also requires a number of Node packages, defined in `package.json`.

## Hacking on Tunebot

1. Install [Vagrant](https://github.com/mopidy/mopidy-spotify).
2. Install [Virtualbox](https://www.virtualbox.org/wiki/Downloads).

3. Clone this repo.

   ```shell
   $ git clone git@github.com:nextbigsoundinc/Tunebot-2.0.git
   ```

4. Install the `vagrant-hostmanager` plugin.

   ```shell
   $ vagrant plugin install vagrant-hostmanager
   ```

5. Bring up a VM with all of Tunebot's dependencies installed.

   ```shell
   $ cd Tunebot-2.0
   $ vagrant up
   ```

You should now be able to hit `http://tunebot.dev` in a browser. As you
make changes to files in your local Tunebot directory, the VM you
started above will automatically reload the server and pick up your
changes. If you need to examine logs, etc, you can SSH into the running
Tunebot VM with `vagrant ssh`.

The following logs may be of interest:

  - `/var/log/redis/current`
  - `/var/log/mopidy/current`
  - `/var/log/tunebot/current`

If you need to restart a service, you can do so with the `sv` command,
like so:

  - `sv restart redis`
  - `sv restart mopidy`
  - `sv restart tunebot`

## Installing on Mac OS X

1. Install [Homebrew](http://brew.sh/)
2. Install [XQuartz](http://xquartz.macosforge.org/landing/)
3. Tap the Mopidy keg:

    ```shell
    $ brew tap mopidy/mopidy
    ```

4. Install mopidy and plugins:

    ```shell
    $ brew install mopidy mopidy-spotify
    $ pip install mopidy-scrobbler
    ```

5. Install Nodejs:

    ```shell
    $ brew install nodejs
    ```

6. Install & start Redis:

    ```shell
    $ brew install redis
    $ ln -sfv /usr/local/opt/redis/homebrew.mxcl.redis.plist ~/Library/LaunchAgents
    $ launchctl load ~/Library/LaunchAgents/homebrew.mxcl.redis.plist
    ```

7. Get Tunebot:

    ```shell
    $ cd ~ && git clone git@github.com:nextbigsoundinc/Tunebot-2.0.git tunebot
    $ sudo ln -s ~/tunebot /opt/tunebot
    ```

8. Install Node dependencies:

   ```
   $ cd /opt/tunebot && npm install
   $ npm install -g forever
   ```

9. Configure Tunebot:

    ```shell
    $ cd /opt/tunebot
    $ cp .env.sample .env

    # Edit .env to set appropriate values

    $ ./scripts/build_templates.sh
    ```

10. Start Mopidy:

     ```shell
     $ cp /opt/tunebot/launchd/homebrew.mopidy.mopidy.plist ~/Library/LaunchAgents
     $ launchctl load ~/Library/LaunchAgents/homebrew.mopidy.mopidy.plist
     ```

11. Start Tunebot:

    ```shell
    $ cd /opt/tunebot; sudo forever start -o tunebot-api.log -e tunebot-err.log api-server.js
    ```

## Building & running a Docker container

These instructions assume you have a working Docker setup already.

1. Build a Docker image.

   ```shell
   $ docker build -t=tunebot .
   ```

2. Run the container, exposing port 80 on the host.

   ```shell
   $ docker run -d -p 80:80 tunebot
   ```
