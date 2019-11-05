'use strict';

const _ = require('lodash');

const contactsBatch = require('./contacts_batch');


const maxMembers = 100000;
const resourceLimit = 50;


function call(connection, parameters, headers, results, db) {
	let self = this;
	let returned = [];

	parameters.max_members = maxMembers;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');

	return this.api.endpoint('ContactGroupsBatch')({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		})
		.then(async function(dataResult) {
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

			if (self.subSubPaginate == null) {
				self.subSubPaginate = contactsBatch;
			}
			
			results = results.concat(data);

			let resourceNames = [];

			_.each(results, function(result) {
				let names = result.contactGroup.memberResourceNames;

				resourceNames = resourceNames.concat(names);
			});

			resourceNames = _.uniq(resourceNames);

			let iterations = Math.ceil(resourceNames.length / resourceLimit);
			let batchPromises = [];

			for (let i = 0; i < iterations; i++) {
				let parameters = {
					resource_names: resourceNames.slice(resourceLimit * i, (resourceLimit * (i + 1)))
				};

				batchPromises.push(self.subSubPaginate(connection, parameters, {}, [], db));
			}

			let batchResults = await Promise.all(batchPromises);

			_.each(batchResults, function(result) {
				returned = returned.concat(result);
			});

			return Promise.resolve(returned);
		})
		.catch(function(err) {
			console.log('Error calling Google Contact Groups Batch:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;