'use strict';

const _ = require('lodash');

const personFields = [
	'emailAddresses',
	'names',
	'coverPhotos',
	'phoneNumbers'
];


function call(connection, parameters, headers, results, db) {
	let self = this;

	parameters.person_fields = personFields.join(',');

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');

	return this.api.endpoint('ContactsBatch')({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		})
		.then(function(dataResult) {
			let [data, response] = dataResult;

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

			return Promise.resolve(results);
		})
		.catch(function(err) {
			console.log('Error calling Google Contacts Batch:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;