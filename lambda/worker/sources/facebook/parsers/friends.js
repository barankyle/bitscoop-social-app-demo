'use strict';

const _ = require('lodash');
const countryRegionData = require('country-region-data');
const moment = require('moment');

const mongoTools = require('../../../util/mongo-tools');


module.exports = function(data, db) {
	let contacts, people, self = this;

	contacts = [];
	people = [];

	if (data && data.length > 0) {
		for (let i = 0; i < data.length; i++) {
			let item = data[i];

			let person = {
				contacts: []
			};

			person.first_name = item.first_name;
			person.middle_name = item.middle_name;
			person.last_name = item.last_name;

			if (item.location) {
				person.address = {};

				if (_.has(item, 'address.location.location.city')) {
					person.address.city = item.location.location.city;
				}

				if (_.has(item, 'location.location.country')) {
					person.address.country = item.location.location.country;

					if (_.has(item, 'location.location.state')) {
						let country = _.find(countryRegionData, function(entry) {
							return entry.countryName === person.address.country;
						});

						let region = _.find(country.regions, function(entry) {
							return entry.shortCode === item.location.location.state;
						});

						person.address.region = region.name;
					}

					if (_.has(item, 'location.location.zip')) {
						person.address.postal_code  = item.location.location.zip.split(',')[0];
					}
				}
			}

			let newContact = {
				identifier: self.connection._id.toString('hex') + ':::facebook:::' + item.id,
				connection_id: self.connection._id,
				provider_id: self.connection.provider_id,
				provider_name: 'facebook',
				user_id: self.connection.user_id,
				name: item.name,
				updated: moment().utc().toDate()
			};

			if (_.has(item, 'picture.data.url')) {
				newContact.avatar_url = item.picture.data.url;
				person.avatar_url = item.picture.data.url;
				person.external_avatar_url = item.picture.data.url;
			}

			if (item.link) {
				person.notes = 'FB page link: ' + item.link;
			}

			contacts.push(newContact);
			person.contacts = person.contacts.concat(newContact);

			if (item.email) {
				let newContact = {
					identifier: self.connection._id.toString('hex') + ':::' + item.email,
					connection_id: self.connection._id,
					provider_id: self.connection.provider_id,
					provider_name: 'facebook',
					user_id: self.connection.user_id,
					handle: item.email,
					updated: moment().utc().toDate()
				};

				contacts.push(newContact);
				person.contacts = person.contacts.concat(newContact);
			}

			people.push(person);
		}

		if (contacts.length > 0) {
			return mongoTools.mongoPeopleAssemble({
				contacts: contacts,
				people: people
			}, db);
		}
		else {
			return Promise.resolve(null);
		}
	}
	else {
		return Promise.resolve(null);
	}
};
