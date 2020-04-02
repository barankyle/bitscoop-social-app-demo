'use strict';

const url = require('url');
const querystring = require('querystring');

const _ = require('lodash');

const limit = 1;


function call(connection, parameters, headers, results, db) {
	let after, next, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');
	outgoingParameters.top = outgoingParameters.top || limit;

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

			next = pageData ? pageData.nextLink : null;

			results = results.concat(data);

			return Promise.resolve();
		})
		.then(function() {
			if (next != null) {
				let parsed = url.parse(next);
				let params = querystring.parse(parsed.query);

				let forwardParams = {
					top: params.$top,
					skip: params.$skip
				};

				return self.paginate(connection, forwardParams, {}, results, db);
			}
			else {
				return Promise.resolve(results);
			}
		})
		.catch(function(err) {
			console.log('Error calling Microsoft Contacts:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;

