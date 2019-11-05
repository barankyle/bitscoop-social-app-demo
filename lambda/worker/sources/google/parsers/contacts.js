'use strict';

const _ = require('lodash');
const moment = require('moment');

const mongoTools = require('../../../util/mongo-tools');


let tagRegex = /#[^#\s]+/g;


module.exports = function(data, db) {
	let contacts, people, self = this;

	contacts = [];
	people = [];

	if (data && data.length > 0) {
		for (let i = 0; i < data.length; i++) {
			let item = data[i];

			if (item.httpStatusCode === 200 && ((item.person.emailAddresses != null && item.person.emailAddresses.length > 0) || (item.person.phoneNumbers != null && item.person.phoneNumbers.length > 0))) {
				let person = {
					contacts: []
				};

				if (item.person.names != null && item.person.names.length > 0) {
					let splitName = item.person.names[0].displayName.split(' ');

					person.first_name = splitName[0];

					if (splitName.length > 1) {
						person.last_name = splitName[splitName.length - 1];
					}

					if (splitName.length > 2) {
						let winnowed = splitName.slice(1, splitName.length - 1);
						person.middle_name = winnowed.join(' ');
					}
				}

				_.each(item.person.emailAddresses, function(address) {
					let newContact = {
						identifier: self.connection._id.toString('hex') + ':::' + address.value,
						connection_id: self.connection._id,
						provider_id: self.connection.provider_id,
						provider_name: 'google',
						user_id: self.connection.user_id,
						name: item.person.names[0].displayName,
						handle: address.value,
						updated: moment().utc().toDate()
					};

					if (item.person.coverPhotos && item.person.coverPhotos.length > 0) {
						newContact.avatar_url = item.person.coverPhotos[0].url
					}

					contacts.push(newContact);
					person.contacts = person.contacts.concat(newContact);
				});

				_.each(item.person.phoneNumbers, function(number) {
					let newContact = {
						identifier: self.connection._id.toString('hex') + ':::' + number.canonicalForm,
						connection_id: self.connection._id,
						provider_id: self.connection.provider_id,
						provider_name: 'google',
						user_id: self.connection.user_id,
						name: item.person.names[0].displayName,
						handle: number.canonicalForm,
						updated: moment().utc().toDate(),
						'tagMasks.source': 'phone-type-' + number.type,
					};

					if (item.person.coverPhotos && item.person.coverPhotos.length > 0) {
						newContact.avatar_url = item.person.coverPhotos[0].url
					}

					contacts.push(newContact);
					person.contacts = person.contacts.concat(newContact);
				});

				people.push(person);
			}
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
