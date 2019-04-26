'use strict';

const _ = require('lodash');


const maxResults = 200;

function call(connection, parameters, headers, results, db) {
	let hasMore, nextCursor, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');
	outgoingParameters.limit = outgoingParameters.limit || maxResults;

	if (this.population != null) {
		outgoingHeaders['X-Populate'] = this.population;
	}

	if (_.get(connection, 'endpoint_data.conversation_history.' + outgoingParameters.channel + '.oldest') != null) {
		outgoingParameters.oldest = connection.endpoint_data.conversation_history[outgoingParameters.channel].oldest;
	}

	return Promise.all([
		this.api.endpoint('ConversationHistory')({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		}),

		this.api.endpoint('ConversationHistoryPage')({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		})
	])
		.then(function([dataResult, pageResult]) {
			let [data, response] = dataResult;
			let [pageData, pageResponse] = pageResult;

			if (!(/^2/.test(response.statusCode)) || (pageData.code)) {
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

			hasMore = pageData.has_more;
			nextCursor = _.get(pageData, 'response_metadata.next_cursor');

			return Promise.resolve();
		})
		.then(function() {
			if (hasMore === true) {
				let forwardParams = {
					channel: outgoingParameters.channel,
					oldest: outgoingParameters.oldest,
					cursor: nextCursor
				};

				return self.subPaginate(connection, forwardParams, {}, results, db);
			}
			else {
				let promise = Promise.resolve();

				if (results.length > 0) {
					promise = promise.then(function() {
						let name = 'endpoint_data.conversation_history.' + outgoingParameters.channel + '.oldest';

						return db.db('live').collection('connections').updateOne({
							_id: connection._id
						}, {
							$set: {
								[name]: results[0].ts
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
			console.log('Error calling Slack Conversation History:');
			console.log(err);

			return Promise.reject(err);
		});
}


module.exports = call;