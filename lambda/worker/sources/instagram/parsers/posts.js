'use strict';

const _ = require('lodash');
const moment = require('moment');

const mongoTools = require('../../../util/mongo-tools');


let tagRegex = /#[^#\s]+/g;


module.exports = function(data, db) {
	var content, events, objectCache, tags, self = this;

	objectCache = {
		contacts: {},
		events: {},
		tags: {}
	};

	content = [];
	tags = [];
	events = new Array(data.length);

	if (data && data.length > 0) {
		for (let i = 0; i < data.length; i++) {
			let item = data[i];

			let newTags = [];

			let datetime = moment(item.timestamp).utc().toDate();

			let newEvent = {
				type: 'created',
				context: 'Shared',
				identifier: this.connection._id.toString('hex') + ':::created:::instagram:::' + item.id,
				datetime: datetime,
				content: [],
				contacts: [],
				connection_id: this.connection._id,
				provider_id: this.connection.provider_id,
				provider_name: 'instagram',
				user_id: this.connection.user_id
			};

			let newMedia = {
				identifier: this.connection._id.toString('hex') + ':::instagram:::' + item.id,
				connection_id: this.connection._id,
				provider_id: this.connection.provider_id,
				provider_name: 'instagram',
				user_id: this.connection.user_id,
				url: item.permalink,
				remote_id: item.id,
				'tagMasks.source': newTags
			};

			if (item.caption) {
				newMedia.title = item.caption;

				let captionTags = item.caption .match(tagRegex);

				if (captionTags != null) {
					for (let j = 0; j < captionTags.length; j++) {
						let tag = captionTags[j].slice(1);

						let newTag = {
							tag: tag,
							user_id: self.connection.user_id
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
			}

			newEvent.content.push(newMedia);

			if (item.media_type === 'IMAGE') {
				newMedia.type = 'image';
				newMedia.embed_format = 'jpeg';
				newMedia.embed_content = item.media_url;
			}
			else if (item.media_type === 'VIDEO') {
				newMedia.type = 'video';
				newMedia.embed_thumbnail = item.thumbnail_url;

				if (item.media_url != null) {
					newMedia.embed_format = 'mp4';
					newMedia.embed_content = item.media_url;
				}
			}
			else if (item.media_type === 'CAROUSEL_ALBUM') {
				newMedia.type = 'album';
				newMedia.embed_format = 'jpg';
				newMedia.embed_content = item.media_url != null ? item.media_url : null;
				newMedia.embed_thumbnail = item.thumbnail_url;

				_.each(item.children, function(child) {
					let childMedia = {
						identifier: self.connection._id.toString('hex') + ':::instagram:::' + child.id,
						connection_id: self.connection._id,
						provider_id: self.connection.provider_id,
						provider_name: 'instagram',
						user_id: self.connection.user_id,
						url: child.permalink,
						remote_id: child.id
					};

					if (child.media_type === 'IMAGE') {
						childMedia.type = 'image';
						childMedia.embed_format = 'jpeg';
						childMedia.embed_content = child.media_url;
					}
					else if (child.media_type === 'VIDEO') {
						childMedia.type = 'video';
						childMedia.embed_thumbnail = child.thumbnail_url;

						if (child.media_url != null) {
							childMedia.embed_format = 'mp4';
							childMedia.embed_content = child.media_url;
						}
					}

					content.push(childMedia);

					newEvent.content.push(childMedia);
				});
			}

			content.push(newMedia);

			events[i] = newEvent;
		}

		return mongoTools.mongoInsert({
			content: content,
			events: events,
			tags: tags
		}, db);
	}
	else {
		return Promise.resolve(null);
	}
};
