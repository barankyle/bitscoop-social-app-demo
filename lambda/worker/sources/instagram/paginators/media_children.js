'use strict';

const _ = require('lodash');

const count = 1;

const fields = [
	'id',
	'timestamp',
	'media_type',
	'media_url',
	'permalink',
	'thumbnail_url'
];


function call(connection, parameters, headers, results, db) {
	let next, nextAfter, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');

	outgoingParameters.fields = fields.join(',');
	outgoingParameters.limit = count;

	return Promise.all([
		this.api.endpoint('MediaChildren')({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		}),

		this.api.endpoint('MediaChildrenPage')({
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

			next = pageData.next;
			nextAfter = pageData && pageData.cursors && pageData.cursors.after ? pageData.cursors.after : null;

			results = results.concat(data);

			return Promise.resolve();
		})
		.then(function() {
			if (next != null && nextAfter != null) {
				return self.subPaginate(connection, {
					after: nextAfter
				}, {}, results);
			}
			else {
				return Promise.resolve(results);
			}
		})
		.catch(function(err) {
			console.log('Error calling Instagram Media Children:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;