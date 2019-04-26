'use strict';

const _ = require('lodash');


const pageSize = 100;


function call(connection, parameters, headers, results, db) {
	let nextPageToken, newStartPageToken, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');
	outgoingParameters.page_size = outgoingParameters.page_size || pageSize;

	if (_.get(connection, 'endpoint_data.photos.page_token') != null && parameters.page_token == null) {
		outgoingParameters.page_token = connection.endpoint_data.photos.page_token;
	}

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

				if (body.message === 'Too Many Requests') {
					return Promise.reject('TOO MANY REQUESTS');
				}
				else {
					return Promise.reject(new Error('Error calling ' + self.name + ': ' + response.statusCode === 504 ? 'Bad Gateway' : body != null ? body.message : 'Dunno, check response'));
				}
			}

			if (results == null) {
				results = [];
			}

			nextPageToken = pageData.nextPageToken;

			results = results.concat(data);

			return Promise.resolve();
		})
		.then(function() {
			if (nextPageToken != null) {
				return self.paginate(connection, {
					page_token: nextPageToken
				}, {}, results, db);
			}
			else {
				return Promise.resolve(results);
			}
		})
		.catch(function(err) {
			console.log('Error calling Google Photos:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;