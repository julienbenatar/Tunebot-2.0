var Q = require('q');
var _ = require('lodash');

function QueryCache (mopidy) {
	var queryCache = {};

	this.search = cachedSearch;

	function cachedSearch (query) {
		var deferred = Q.defer();

		var result = queryCache[query];

		if (!_.isUndefined(result)) {
			deferred.resolve(result);
		}
		else {
			mopidy.library.search({
				any: query
			})
			.then(function (resultsArr) {
				// mopidy seems to be returning these in an inconsistent order
				var tracks;

				if ( !_.isUndefined(resultsArr[0].tracks) ) {
					tracks = resultsArr[0].tracks;
				}
				else {
					tracks = resultsArr[1].tracks;
				}

				return tracks;
			})
			.then(function (tracks) {
				// disabling cache since it seems to be crippling the server
				// queryCache[query] = tracks;
				return tracks;
			})
			.then(deferred.resolve)
			.catch(deferred.reject);
		}

		return deferred.promise;
	}

}

module.exports = QueryCache;
