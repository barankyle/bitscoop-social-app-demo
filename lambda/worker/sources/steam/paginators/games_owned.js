'use strict';

const _ = require('lodash');

const perPage = 2;


function call(connection, parameters, headers, results, db) {
	let dataLength, lastItem, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');

	if (this.population != null) {
		outgoingHeaders['X-Populate'] = this.population;
	}

	return this.api.endpoint(this.mapping)({
		headers: outgoingHeaders,
		parameters: outgoingParameters
	})
		.then(function([data, response]) {
			if (!(/^2/.test(response.statusCode))) {
				console.log(response);

				let body;

				try {
					body = response.body != null ? JSON.parse(response.body) : null;
				} catch(err) {
					console.log('Error parsing response body');
					console.log(err);

					body = {};
				}

				return Promise.reject(new Error('Error calling ' + self.name + ': ' + response.statusCode === 504 ? 'Bad Gateway' : body != null ? body.message : 'Dunno, check response'));
			}

			if (results == null) {
				results = [];
			}

			results = results.concat(data);

			return Promise.resolve();
		})
		.then(function() {
			return Promise.resolve(results);
		})
		.catch(function(err) {
			console.log('Error calling Steam Games Owned:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;