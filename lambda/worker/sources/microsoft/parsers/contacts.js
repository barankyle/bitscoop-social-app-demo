'use strict';

const _ = require('lodash');
const countryRegionData = require('country-region-data');
const moment = require('moment');

const mongoTools = require('../../../util/mongo-tools');


module.exports = function(data, db) {
	let address, contacts, people, self = this;

	contacts = [];
	people = [];

	if (data && data.length > 0) {
		for (let i = 0; i < data.length; i++) {
			let item = data[i];

			let person = {
				contacts: []
			};

			person.first_name = item.givenName;
			person.middle_name = item.middleName;
			person.last_name = item.surname;

			if (item.homeAddress && (item.homeAddress.countryOrRegion != null || item.homeAddress.street != null)) {
				address = item.homeAddress;
			}
			else if (item.businessAddress && (item.businessAddress.countryOrRegion != null || item.businessAddress.street != null)) {
				address = item.businessAddress;
			}

			if (address != null) {
				person.address = {};

				if (address.street) {
					person.address.street_address = address.street;
				}

				if (address.city) {
					person.address.city = address.city;
				}

				if (address.countryOrRegion) {
					person.address.country = address.countryOrRegion;

					if (address.state) {
						let country = _.find(countryRegionData, function(entry) {
							return entry.countryName === person.address.country;
						});

						if (country != null) {
							let region = _.find(country.regions, function(entry) {
								return entry.shortCode === address.state;
							});

							if (region == null) {
								region = _.find(country.regions, function(entry) {
									return entry.name === address.state;
								})
							}

							if (region != null) {
								person.address.region = region.name;
							}
						}
					}
				}

				if (address.postalCode) {
					person.address.postal_code  = address.postalCode;
				}
			}

			_.each(item.emailAddresses, function(address) {
				let newContact = {
					identifier: self.connection._id.toString('hex') + ':::' + address.address,
					connection_id: self.connection._id,
					provider_id: self.connection.provider_id,
					provider_name: 'microsoft',
					user_id: self.connection.user_id,
					handle: address.address,
					updated: moment().utc().toDate()
				};

				if (address.name !== address.address) {
					newContact.name = address.name;
				}

				contacts.push(newContact);
				person.contacts = person.contacts.concat(newContact);
			});

			_.each(item.homePhones, function(number) {
				let newContact = {
					identifier: self.connection._id.toString('hex') + ':::' + number,
					connection_id: self.connection._id,
					provider_id: self.connection.provider_id,
					provider_name: 'microsoft',
					user_id: self.connection.user_id,
					name: item.displayName,
					handle: number,
					updated: moment().utc().toDate(),
					'tagMasks.source': ['phone-type-home'],
				};

				contacts.push(newContact);
				person.contacts = person.contacts.concat(newContact);
			});

			_.each(item.businessPhones, function(number) {
				let newContact = {
					identifier: self.connection._id.toString('hex') + ':::' + number,
					connection_id: self.connection._id,
					provider_id: self.connection.provider_id,
					provider_name: 'microsoft',
					user_id: self.connection.user_id,
					name: item.displayName,
					handle: number,
					updated: moment().utc().toDate(),
					'tagMasks.source': ['phone-type-business'],
				};

				contacts.push(newContact);
				person.contacts = person.contacts.concat(newContact);
			});

			if (item.mobilePhone != null) {
				let newContact = {
					identifier: self.connection._id.toString('hex') + ':::' + item.mobilePhone,
					connection_id: self.connection._id,
					provider_id: self.connection.provider_id,
					provider_name: 'microsoft',
					user_id: self.connection.user_id,
					name: item.displayName,
					handle: item.mobilePhone,
					updated: moment().utc().toDate(),
					'tagMasks.source': ['phone-type-mobile'],
				};

				contacts.push(newContact);
				person.contacts = person.contacts.concat(newContact);
			}

			_.each(item.imAddresses, function(address) {
				let newContact = {
					identifier: self.connection._id.toString('hex') + ':::' + address,
					connection_id: self.connection._id,
					provider_id: self.connection.provider_id,
					provider_name: 'microsoft',
					user_id: self.connection.user_id,
					name: item.displayName,
					handle: address,
					updated: moment().utc().toDate(),
					'tagMasks.source': ['phone-type-business'],
				};

				contacts.push(newContact);
				person.contacts = person.contacts.concat(newContact);
			});

			if (item.personalNotes) {
				person.notes = item.personalNotes;
			}

			if (item.birthday != null) {
				if (person.notes == null) {
					person.notes = '';
				}

				person.notes += '\nBirthday: ' + item.birthday;
			}

			if (item.businessHomepage != null) {
				if (person.notes == null) {
					person.notes = '';
				}

				person.notes += '\nBusiness Homepage: ' + item.businessHomePage;
			}

			if (item.companyName != null) {
				if (person.notes == null) {
					person.notes = '';
				}

				person.notes += '\nCompany Name: ' + item.companyName;
			}

			if (item.officeLocation != null) {
				if (person.notes == null) {
					person.notes = '';
				}

				person.notes += '\nOffice location: ' + item.officeLocation;
			}

			if (person.contacts.length > 0) {
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
