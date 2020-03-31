'use strict';

const _ = require('lodash');


const fields = [
	'id',
	'email',
	'first_name',
	'last_name',
	'link',
	'location{location}',
	'middle_name',
	'name',
	'picture'
];

const limit = 20;


function call(connection, parameters, headers, results, db) {
	console.log('Paginating Facebook friends');
	let after, next, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');
	outgoingParameters.limit = outgoingParameters.limit || limit;

	if (_.get(connection, 'endpoint_data.friends.after') != null && outgoingParameters.after == null) {
		outgoingParameters.after = connection.endpoint_data.friends.after;
	}

	let fieldsCopy = _.clone(fields);

	outgoingParameters.fields = fieldsCopy.join();

	return Promise.all([
		this.api.endpoint(this.mapping)({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		}),

		this.api.endpoint(this.mapping + 'Page')({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		})
	])
		.then(function([dataResult, pageResult]) {
			let [data, response] = dataResult;
			let [pageData, pageResponse] = pageResult;

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

			next = pageData ? pageData.next : null;
			after = pageData && pageData.cursors ? pageData.cursors.after : null;

			results = results.concat(data);

			return Promise.resolve();
		})
		.then(function() {
			if (next != null) {
				let forwardParams = {
					after: after,
				};

				return self.paginate(connection, forwardParams, {}, results, db);
			}
			else {
				let promise = Promise.resolve();

				if (results.length > 0) {
					promise = promise.then(function() {
						return db.db('live').collection('connections').updateOne({
							_id: connection._id
						}, {
							$set: {
								'endpoint_data.friends.after': after
							}
						});
					});
				}

				return promise.then(function() {
					return Promise.resolve(results);
				});
			}
		})
		.catch(function(err) {
			console.log('Error calling Facebook Friends:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;

