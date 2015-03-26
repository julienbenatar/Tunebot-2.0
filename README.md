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
