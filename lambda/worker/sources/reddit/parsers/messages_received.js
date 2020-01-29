'use strict';

const _ = require('lodash');
const moment = require('moment');

const mongoTools = require('../../../util/mongo-tools');

let tagRegex = /#[\w-]{1,50}(?<=[A-z]+)/g;


module.exports = function(data, db) {
	var contacts, content, events, objectCache, tags;

	objectCache = {
		contacts: {},
		tags: {}
	};

	contacts = [];
	content = new Array(data.length);
	tags = [];
	events = new Array(data.length);

	if (data && data.length > 0) {
		for (let i = 0; i < data.length; i++) {
			let item = data[i];

			let newMessage = {
				identifier: this.connection._id.toString('hex') + ':::reddit:::' + item.data.name,
				type: 'text',
				text: item.data.body,
				remote_id: item.data.name,
				title: item.data.subject,
				connection_id: this.connection._id,
				provider_id: this.connection.provider_id,
				provider_name: 'reddit',
				user_id: this.connection.user_id
			};


			let newTags = [];
			let titleTags = newMessage.title.match(tagRegex);

			if (titleTags != null) {
				for (let j = 0; j < titleTags.length; j++) {
					let tag = titleTags[j].slice(1);

					let newTag = {
						tag: tag,
						user_id: this.connection.user_id
					};

					if (!_.has(objectCache.tags, newTag.tag)) {
						objectCache.tags[newTag.tag] = newTag;

						tags.push(objectCache.tags[newTag.tag]);
					}

					if (newTags.indexOf(newTag.tag) === -1) {
						newTags.push(newTag.tag);
					}
				}
			}

			if (newMessage.text) {
				let messageTags = newMessage.text.match(tagRegex);

				if (messageTags != null) {
					for (let j = 0; j < messageTags.length; j++) {
						let tag = messageTags[j].slice(1);

						let newTag = {
							tag: tag,
							user_id: this.connection.user_id
						};
						if (!_.has(objectCache.tags, newTag.tag)) {
							objectCache.tags[newTag.tag] = newTag;

							tags.push(objectCache.tags[newTag.tag]);
						}

						if (newTags.indexOf(newTag.tag) === -1) {
							newTags.push(newTag.tag);
						}
					}
				}

				newMessage['tagMasks.source'] = newTags;
			}

			content[i] = newMessage;

			let newEvent = {
				type: 'messaged',
				context: 'Received private message',
				identifier: this.connection._id.toString('hex') + ':::received:::reddit:::' + item.data.name,
				datetime: moment(item.data.created_utc * 1000).utc().toDate(),
				content: [newMessage],
				connection_id: this.connection._id,
				provider_id: this.connection.provider_id,
				provider_name: 'reddit',
				user_id: this.connection.user_id
			};

			let newContact = {};

			newContact = {
				identifier: this.connection._id.toString('hex') + ':::reddit:::' + item.data.author,
				connection_id: this.connection._id,
				provider_id: this.connection.provider_id,
				provider_name: 'reddit',
				user_id: this.connection.user_id,
				handle: item.data.author
			};

			newEvent.contact_interaction_type = 'from';

			if (!_.has(objectCache.contacts, newContact.identifier)) {
				objectCache.contacts[newContact.identifier] = newContact;
				contacts.push(objectCache.contacts[newContact.identifier]);
			}

			newEvent.contacts = [objectCache.contacts[newContact.identifier]];

			events[i] = newEvent;
		}

		return mongoTools.mongoInsert({
			contacts: contacts,
			content: content,
			events: events,
			tags: tags
		}, db);
	}
	else {
		return Promise.resolve(null);
	}
};
