'use strict';

const querystring = require('querystring');
const url = require('url');

const _ = require('lodash');
const moment = require('moment');


const fields = [
	'id',
	'url',
	'created_at',
	'note',
	'original_link',
	'media',
	'attribution',
	'image'
];

const limit = 2;


function call(connection, parameters, headers, results, db) {
	let cursor, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');
	outgoingParameters.limit = outgoingParameters.limit || limit;

	if (this.population != null) {
		outgoingHeaders['X-Populate'] = this.population;
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

			cursor = pageData.cursor;

			results = results.concat(data);

			return Promise.resolve();
		})
		.then(function() {
			if (cursor != null) {
				return self.paginate(connection, {
					cursor: cursor
				}, {}, results, db);
			}
			else {
				return Promise.resolve(results);
			}
		})
		.catch(function(err) {
			console.log('Error calling Facebook Posts:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;

