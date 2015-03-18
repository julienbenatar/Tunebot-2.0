var EventEmitter = require('events').EventEmitter;

function PositionWatcher (mopidy) {
	var _this = this;

	mopidy.once('state:online', function () {
		var intervalNum = setInterval(function () {
		mopidy.playback.getTimePosition().then(function (time) {
			_this.emit('event:timePositionChange', time);
			});
		}, 1000);

		mopidy.once('state:offline', function () {
			clearInterval(intervalNum);
			_this.removeAllListeners();
		});
	});
}

PositionWatcher.prototype = new EventEmitter();

module.exports = PositionWatcher;
