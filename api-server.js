var yargs = require('yargs').argv;
var _ = require('lodash');
var Mopidy = require('mopidy');
var express = require('express');
var url = require('url');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var redis = require('redis');
var PositionWatcher = require('./PositionWatcher.js');
var fs = require('fs');
var Q = require('q');
var QueryCache = require('./QueryCache.js');
var schedule = require('node-schedule');

var configObj = {
  API: {}
};

if (fs.existsSync('./tunebot.json')) {
  configObj = JSON.parse(fs.readFileSync('./tunebot.json', 'utf8'));
}



var MOPIDY_HOST = yargs.MOPIDY_HOST || configObj.MOPIDY.HOST;
var MOPIDY_PORT = yargs.MOPIDY_PORT || configObj.MOPIDY.PORT;
var MOPIDY_WEBSOCKET_PATH = "/mopidy/ws/";

var WEBSOCKET_URL = "ws://" + MOPIDY_HOST + ':' + MOPIDY_PORT + MOPIDY_WEBSOCKET_PATH;

console.log(WEBSOCKET_URL);
var API_HOST = yargs.API_HOST || configObj.API.HOST;
var API_PORT = +yargs.API_PORT || +configObj.API.PORT;


var mopidy;
var positionWatcher;
var redisClient = redis.createClient();
var cache;


function registerTrack (tlid, user) {
  var deferred = Q.defer();

  if (user.email === 'alecia@thenextbigsound.com') {
    user.picture = 'https://www.nextbigsound.com/images/less/marketing/about/alecia.png';
  }

  redisClient.hset('tb:queued:songs', tlid, JSON.stringify(user), function (err, result) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(result);
    }
  });

  return deferred.promise;

}

function getLastSkipUser() {
  var deferred = Q.defer();

  redisClient.get('tb:lastSkippedBy', function (err, result) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(JSON.parse(result));
    }
  });

  return deferred.promise;
}


function getLastPlayToggleUser () {
  var deferred = Q.defer();

  redisClient.get('tb:lastToggledBy', function (err, result) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(JSON.parse(result));
    }
  });

  return deferred.promise;
}


function setLastToggledBy (userObj) {
  var deferred = Q.defer();

  redisClient.set('tb:lastToggledBy', JSON.stringify(userObj), function (err, result) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(result);
    }
  });

  return deferred.promise;
}

function setLastSkippedBy (userObj) {
  var deferred = Q.defer();

  redisClient.set('tb:lastSkippedBy', JSON.stringify(userObj), function (err, result) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(result);
    }
  });

  return deferred.promise;
}

function getLastVolumeBy (userObj) {
  var deferred = Q.defer();

  redisClient.get('tb:lastVolumeBy', function (err, result) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(JSON.parse(result));
    }
  });

  return deferred.promise;
}

function setLastVolumeBy (userObj) {
  var deferred = Q.defer();

  redisClient.setex('tb:lastVolumeBy', 60, JSON.stringify(userObj), function (err, result) {
    if (err) {
      deferred.reject(err);
    }
    else {
      deferred.resolve(result);
    }
  });

  return deferred.promise;
}


function associateTracks (tracksArr) {
  var tlidArr = _.pluck(tracksArr, 'tlid');

  var deferred = Q.defer();

  if (_.isEmpty(tracksArr)) {
    deferred.resolve([]);
  }
  else {
    redisClient.hmget('tb:queued:songs', tlidArr, function (err, result) {
      if (err) {
        deferred.reject(err);
      }
      else {
        var userObjArr = _.map(result, JSON.parse);

        var trackUserPairs = _.zip(tracksArr, userObjArr);
        var associatedTracks = _.map(trackUserPairs, function (pair) {

          return {
            track: pair[0],
            user: pair[1]
          };

        });

        deferred.resolve(associatedTracks);
      }
    });
  }

  return deferred.promise;
}


function prepareMopidy (WEBSOCKET_URL) {
	var deferred = Q.defer();

	// todo is there a cleaner way to expose this to the api server?
	mopidy = new Mopidy({
		webSocketUrl: WEBSOCKET_URL
	});

  positionWatcher = new PositionWatcher(mopidy);
  cache = new QueryCache(mopidy);

	// todo handle initialization failure case
	mopidy.on('state:online', function () {
			mopidy.tracklist.setConsume(true);

			deferred.resolve();
	});

	mopidy.on('event:trackPlaybackEnded', function (track) {
		mopidy.tracklist.remove({'tlid': [track.tl_track.tlid]});
	});

	return deferred.promise;
}

function clear (req, res, next) {

	console.log('clear route called');

	mopidy.tracklist.clear()
		.then(function () {
			console.log('clear completed succesfully');
		})
		.catch(function (e) {
			console.log('error clearing playlist');
		});

	res.status(200).end();

}


function googleOauth (req, res, next) {
  res.send('<a href="' + authenticationUrl + '">log in to tunebot</a>');
}

function getState (req, res, next) {

	Q.all([
    getLastPlayToggleUser(),
    getLastSkipUser(),
		mopidy.playback.getState(),
		mopidy.playback.getCurrentTrack(),
		mopidy.playback.getMute(),
		mopidy.playback.getTimePosition(),
		mopidy.playback.getVolume(),
		mopidy.tracklist.getTlTracks(),
    getLastVolumeBy()
	]).spread(function (lastPlayToggleUser, lastSkipUser, state, currentTrack, isMute, timePosition, volume, tracklist, lastVolumeUser) {

    associateTracks(tracklist)
      .then(function (associatedTracksArr) {

        var stateResponse = {
          lastPlayToggleUser: lastPlayToggleUser,
          lastSkipUser: lastSkipUser,
          lastVolumeUser: lastVolumeUser,
          state: state,
          currentTrack: currentTrack,
          isMute: isMute,
          timePosition: timePosition,
          volume: volume,
          tracklist: associatedTracksArr
        };

        res.json(stateResponse);


      })
      .catch(function (e) {
        console.log('error associating tracks');
      });



  })
	.catch(function (e) {
		console.log('problem getting state');
	});

}

function setVolume (req, res, next) {
	var newVolume = req.param('volume');

	mopidy.playback.setVolume(+newVolume).then(function () {
    setLastVolumeBy(req.user);
  });

	res.status(200).end();

}

function incrementVolume (req, res, next) {
	mopidy.playback.getVolume()
		.then(function (volume) {
			return volume + 1;
		})
		.then(mopidy.playback.setVolume)
    .then(function () {
      setLastVolumeBy(req.user);
    });
		res.status(200).end();
}


function decrementVolume (req, res, next) {
	mopidy.playback.getVolume()
		.then(function (volume) {
			return volume - 1;
		})
		.then(mopidy.playback.setVolume)
    .then(function () {
      setLastVolumeBy(req.user);
    });

		res.status(200).end();
}

function previous (req, res, next) {
  mopidy.playback.previous();
  res.status(200).end();
}

function skip (req, res, next) {
  mopidy.playback.next();
	res.status(200).end();
}

function play (req, res, next) {
  mopidy.playback.getState().then(function (state) {
    if (state !== 'playing') {
      mopidy.tracklist.getTracks().then(function (tracks) {
        if (!_.isEmpty(tracks)) {
          mopidy.playback.play(tracks[0].tl_track);
        }
      });
    }
  });

	res.status(200).end();

}

function pause (req, res, next) {
  mopidy.playback.getState().then(function (state) {
    if (state === 'playing') {
      mopidy.playback.pause();

      var picture = req.param('picture');
      var email = req.param('email');
      var name = req.param('name');

      setLastToggledBy({
        email: email,
        picture: picture,
        name: name
      });

    }
  });

	res.status(200).end();
}


function search (req, res, next) {
	var searchTerm = req.param('query');

	cache.search(searchTerm)
		.then(function (results) {
			res.send(results);
		})
		.catch(function (e) {
			res.status(500).send('oops, that caused an error on our server');
		})
		.finally(next);
}

function removeTrack (req, res, next) {
  var tlid = req.body.tlid;

  mopidy.tracklist.remove({'tlid': [tlid]}).then(function() {

    var picture = req.param('picture');
    var email = req.param('email');
    var name = req.param('name');

    setLastSkippedBy({
      email: email,
      picture: picture,
      name: name
    });

  });

  res.status(200).end();
}

function queueTrackImmediate (req, res, next) {
    var trackUri = req.body.uri;

    var blacklisted = regexes.some(function (regexObj) {
      return regexObj.regex.test(req.body.uri);
    });

    if (blacklisted) {
      res.status(400).end();
      next();
    }

    else {

        Q.all([
          mopidy.playback.getState(),
          mopidy.tracklist.add(null, 1, trackUri)
        ]).spread(function (state, trackAddedResult) {
          var tlid = trackAddedResult[0].tlid;

          var picture = req.param('picture');

          // not working, needs some love
          // console.log('picture: ', picture);

          // // default, blank picture
          // if (picture === 'https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg') {
          //   console.log('blank picture');
          //   picture = {
          //     moshe: 'https://www.nextbigsound.com/images/less/marketing/about/moshe.jpg',
          //     samir: 'https://www.nextbigsound.com/images/less/marketing/about/samir.jpg',
          //     syd: 'https://www.nextbigsound.com/images/less/marketing/about/syd.jpg',
          //     victor: 'https://www.nextbigsound.com/images/less/marketing/about/victor.jpg',
          //     alecia: 'https://www.nextbigsound.com/images/less/marketing/about/alecia.jpg'
          //   }[email.split('@')[0]];
          // }

          var email = req.param('email');
          var name = req.param('name');

          registerTrack(tlid, {
            email: email,
            picture: picture,
            name: name
          });

          if (state !== 'playing') {
            mopidy.playback.play();
          }

        });

        res.send(trackUri);


    }

}

function queueTrack (req, res, next) {
	var trackUri = req.body.uri;

  var blacklisted = regexes.some(function (regexObj) {
    return regexObj.regex.test(req.body.uri);
  });

  if (blacklisted) {
    res.status(400).end();
    next();
  }

  else {

      Q.all([
        mopidy.playback.getState(),
        mopidy.tracklist.add(null, null, trackUri)
      ]).spread(function (state, trackAddedResult) {
        var tlid = trackAddedResult[0].tlid;

        var picture = req.param('picture');

        // not working, needs some love
        // console.log('picture: ', picture);

        // // default, blank picture
        // if (picture === 'https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg') {
        //   console.log('blank picture');
        //   picture = {
        //     moshe: 'https://www.nextbigsound.com/images/less/marketing/about/moshe.jpg',
        //     samir: 'https://www.nextbigsound.com/images/less/marketing/about/samir.jpg',
        //     syd: 'https://www.nextbigsound.com/images/less/marketing/about/syd.jpg',
        //     victor: 'https://www.nextbigsound.com/images/less/marketing/about/victor.jpg',
        //     alecia: 'https://www.nextbigsound.com/images/less/marketing/about/alecia.jpg'
        //   }[email.split('@')[0]];
        // }

        var email = req.param('email');
        var name = req.param('name');

        registerTrack(tlid, {
          email: email,
          picture: picture,
          name: name
        });

        if (state !== 'playing') {
          mopidy.playback.play();
        }

      });

      res.send(trackUri);


  }


}

var regexes = [];

function addRegexToBlacklist (req, res, next) {
  var regex = new RegExp(req.body.regex);
  regexes.push({
    text: req.body.regex,
    regex: regex
  });
  res.status(200).end();
}

function removeRegexFromBlacklist (req, res, next) {
  var regexText = req.body.regex;

 regexes = _.reject(regexes, function (regexObj) {
  return regexObj.text === regexText;
 });

 res.status(200).end();
}

function getTrackBlacklist (req, res, next) {
  var regexStrings = _.pluck(regexes, 'text');

  res.json(regexStrings);

}


var app = express();

var expressWs = require('express-ws')(app);

// sets up websocket listeners and appropriate teardown events
function setWebsocketListeners (ws, req) {
  ws.on('error', function () {
    positionWatcher.removeListener('event:timePositionChange', handleTimeChanged);
    mopidy.off('event:volumeChanged', handleVolumeChanged);
    mopidy.off('event:trackPlaybackResumed', handlePlaybackResumed);
    mopidy.off('event:trackPlaybackStarted', handlePlaybackStarted);
    mopidy.off('event:trackPlaybackPaused', handlePlaybackPaused);
    mopidy.off('event:trackPlaybackEnded', handleTracklistChanged);
  });

  ws.on('close', function () {
    positionWatcher.removeListener('event:timePositionChange', handleTimeChanged);
    mopidy.off('event:volumeChanged', handleVolumeChanged);
    mopidy.off('event:trackPlaybackResumed', handlePlaybackResumed);
    mopidy.off('event:trackPlaybackStarted', handlePlaybackStarted);
    mopidy.off('event:trackPlaybackPaused', handlePlaybackPaused);
    mopidy.off('event:trackPlaybackEnded', handleTracklistChanged);
  });

  // name in-line function so it can be removed on ws close/error
  positionWatcher.on('event:timePositionChange', handleTimeChanged);
  function handleTimeChanged (time) {
      var message = {
        type: 'timePositionChange',
        data: time
      };

      var jsonData = JSON.stringify(message);

      ws.send(jsonData);
    }


  mopidy.on('event:volumeChanged', handleVolumeChanged);
  function handleVolumeChanged (volumeEvent) {
      var message = {
        type: 'volumeChanged',
        data: volumeEvent.volume
      };

      var jsonData = JSON.stringify(message);

      ws.send(jsonData);
    }

  mopidy.on('event:trackPlaybackStarted', handlePlaybackStarted);
  function handlePlaybackStarted (track) {
      var message = {
        type: 'playerStateChanged',
        data: {
          type: 'playing',
          track: track.tl_track.track
        }
      };

      var jsonData = JSON.stringify(message);
      ws.send(jsonData);

    }

  mopidy.on('event:trackPlaybackResumed', handlePlaybackResumed);
  function handlePlaybackResumed (track) {
      var message = {
        type: 'playerStateChanged',
        data: {
          type: 'playing',
          track: track.tl_track.track
        }
      };

      var jsonData = JSON.stringify(message);
      ws.send(jsonData);
    }

  mopidy.on('event:trackPlaybackPaused', handlePlaybackPaused);
  function handlePlaybackPaused (track) {
      var message = {
        type: 'playerStateChanged',
        data: {
          type: 'paused',
          track: track.tl_track.track
        }
      };

      var jsonData = JSON.stringify(message);
      ws.send(jsonData);

    }

  function handleTracklistChanged (tracklist) {
      mopidy.tracklist.getTlTracks().then(function (tracks) {

        associateTracks(tracks).then(function (associatedTracksArr) {
            var message = {
              type: 'tracklistUpdate',
              data: associatedTracksArr
            };

            var jsonTracks = JSON.stringify(message);
            ws.send(jsonTracks);
          });

        });
      }


  mopidy.on('event:trackPlaybackEnded', handleTracklistChanged);

  mopidy.on('event:tracklistChanged', handleTracklistChanged);
}

// move to setup function
app.ws('/tunebot/state/updates', setWebsocketListeners);


app.use( cookieParser() );
app.use( bodyParser.json() );

app.all('/*', function(req, res, next) {
		res.header('Access-Control-Allow-Origin', '*');
		res.header('Access-Control-Allow-Headers', 'Content-Type,X-Requested-With');
		next();
});
app.all('/*', function (req, res, next) {
  var picture = req.param('picture');
  var email = req.param('email');
  var name = req.param('name');

  var user = {
    picture: picture,
    email: email,
    name: name
  };

  req.user = user;

	next();
});

app.get('/home.html', function (req, res, next) {
	var templateLocation = __dirname + '/home.html';
	res.sendFile(templateLocation);
});

app.get('/admin.html', function (req, res, next) {
  var templateLocation = __dirname + '/admin.html';
  res.sendFile(templateLocation);
});


app.get('/login.html', function (req, res, next) {
	var templateLocation = __dirname + '/login.html';
	res.sendFile(templateLocation);
});

app.get('/slider.html', function (req, res, next) {
  var templateLocation = __dirname + '/slider.html';
  res.sendFile(templateLocation);
});

app.get('/', function (req, res, next) {
	res.sendFile(__dirname + '/index.html');
});


app.get('/favicon.ico', function (req, res, next) {
  res.sendFile(__dirname + '/static/images/favicon.ico');
});

app.get('/static/css/:filename', function (req, res, next) {
	res.sendFile(__dirname + '/static/css/' + req.param('filename'));
});

app.get('/static/images/:filename', function (req, res, next) {
	res.sendFile(__dirname + '/static/images/' + req.param('filename'));
});

app.get('/static/js/:filename', function (req, res, next) {
	res.sendFile(__dirname + '/static/js/' + req.param('filename'));
});

app.get('/state', getState);
app.post('/queueTrack', queueTrack);
app.post('/queueTrack/immediate', queueTrackImmediate);
app.post('/removeTrack', removeTrack);
app.post('/search/:query', search);
app.post('/play', play);
app.post('/pause', pause);
// app.post('/skip', skip);
app.post('/previous', previous);
app.post('/volume/set', setVolume);
app.post('/volume/up', incrementVolume);
app.post('/volume/down', decrementVolume);
app.post('/clear', clear);
app.post('/addRegex', addRegexToBlacklist);
app.post('/removeRegex', removeRegexFromBlacklist);
app.get('/getTrackBlacklist', getTrackBlacklist);
app.post('/authenticate', googleOauth);

var remixToIgnitionSchedule;

prepareMopidy(WEBSOCKET_URL)
	.then(function () {
		app.listen(API_PORT, API_HOST);

      // every friday at 5pm
      var rule = new schedule.RecurrenceRule();
      rule.dayOfWeek = 5;
      rule.hour = 17;
      rule.minute = 0;
      rule.second = 0;

      schedule.scheduleJob(rule, function () {
        // play remix to ignition
        mopidy.tracklist.add(null, 1, 'spotify:track:0nmxH6IsSQVT1YEsCB9UMi').then(function () {
          mopidy.playback.getState().then(function (state) {
            if (state !== 'playing') {
              mopidy.playback.play();
            }
          });
        });
      });
	});
