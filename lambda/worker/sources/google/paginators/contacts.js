'use strict';

const _ = require('lodash');

const contactGroupsBatch = require('./contact_groups_batch');


const maxResults = 100;


function call(connection, parameters, headers, results, db) {
	let nextPageToken, nextSyncToken, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');
	outgoingParameters.page_size = outgoingParameters.page_size || maxResults;

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

			nextPageToken = pageData.nextPageToken;
			nextSyncToken = pageData.nextSyncToken;

			if (!self.subPaginate) {
				self.subPaginate = contactGroupsBatch;
			}

			let resourceNames = [
				'contactGroups/starred'
			];

			_.each(data, function(item) {
				if (/lifescope/i.test(item.name) === true) {
					resourceNames.push(item.resourceName);
				}
			});

			let parameters = {
				resource_names: resourceNames
			};

			return self.subPaginate(connection, parameters, {}, [], db);
		})
		.then(function(subResults) {
			if (results == null) {
				results = [];
			}

			results = results.concat(subResults);

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
			console.log('Error calling Google Contact Groups:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;