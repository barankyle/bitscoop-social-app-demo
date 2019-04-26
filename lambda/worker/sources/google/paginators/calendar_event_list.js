'use strict';

const _ = require('lodash');


const maxResults = 100;


function call(connection, parameters, headers, results, db) {
	let nextPageToken, nextSyncToken, self = this;

	let outgoingHeaders = headers || {};
	let outgoingParameters = parameters || {};

	outgoingHeaders['X-Connection-Id'] = connection.remote_connection_id.toString('hex');
	outgoingParameters.max_results = outgoingParameters.max_results || maxResults;

	let encodedCalendarId = parameters.calendar_id.replace(/\./g, '%2E');

	if (this.population != null) {
		outgoingHeaders['X-Populate'] = this.population;
	}

	if (_.get(connection, 'endpoint_data.calendar_event_list.' + encodedCalendarId + '.sync_token') != null && parameters.sync_token == null) {
		outgoingParameters.sync_token = connection.endpoint_data.calendar_event_list[encodedCalendarId].sync_token;
	}

	return Promise.all([
		this.api.endpoint('CalendarEventList')({
			headers: outgoingHeaders,
			parameters: outgoingParameters
		}),

		this.api.endpoint('CalendarEventListPage')({
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

				if (body && body.message === 'Gone' && body.code === 410) {
					connection.endpoint_data.calendar_event_list[encodedCalendarId].sync_token = null;

					return db.db('live').collection('connections').updateOne({
						_id: connection._id
					}, {
						$unset: {
							['endpoint_data.calendar_event_list.' + encodedCalendarId + '.sync_token']: ''
						}
					})
						.then(function() {
							return Promise.reject('SYNC TOKEN OUT OF DATE');
						});
				}
				else {
					return Promise.reject(new Error('Error calling ' + self.name + ': ' + response.statusCode === 504 ? 'Bad Gateway' : body != null ? body.message : 'Dunno, check response'));
				}
			}

			if (results == null) {
				results = [];
			}
			
			results = results.concat(data);

			nextPageToken = pageData.nextPageToken;
			nextSyncToken = pageData.nextSyncToken;

			return Promise.resolve();
		})
		.then(function() {
			if (nextPageToken != null) {
				return self.subPaginate(connection, {
					calendar_id: parameters.calendar_id,
					page_token: nextPageToken
				}, {}, results, db);
			}
			else {
				let promise = Promise.resolve();

				if (results.length > 0) {
					promise = promise.then(function() {
						return db.db('live').collection('connections').updateOne({
							_id: connection._id
						}, {
							$set: {
								['endpoint_data.calendar_event_list.' + encodedCalendarId + '.sync_token']: nextSyncToken
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
			console.log('Error calling Google Calendar Event List:');
			console.log(err);

			if (err === 'SYNC TOKEN OUT OF DATE') {
				return self.subPaginate(connection, {
					calendar_id: parameters.calendar_id
				}, {}, results, db);
			}
			else {
				return Promise.reject(err);
			}
		});
}


module.exports = call;