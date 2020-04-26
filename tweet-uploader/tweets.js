export async function* parseJSON(asyncIterable) {
	for await (const jsonParsable of asyncIterable)
		yield JSON.parse(jsonParsable);
}

export async function* processTweets(asyncRawTweets) {
	for await (const rawTweet of asyncRawTweets) {
		yield new Tweet(rawTweet);
	}
}

export async function* toPrettyJSON(asyncIterable) {
	for await (const item of asyncIterable) {
		yield JSON.stringify(item.tweets(), null, '\t');
	}
}

export class Tweet {
	constructor(tweet) {
		this._id = tweet.id_str;
		this.hashtags = tweet.entities.hashtags || [];
		this.inReplyToScreenName = tweet.in_reply_to_screen_name || null;
		this.inReplyToStatusId = tweet.in_reply_to_status_id_str || null;
		this.inReplyToUserId = tweet.in_reply_to_user_id_str || null;
		this.isQuoteStatus = tweet.is_quote_status;
		this.isReply =
			tweet.in_reply_to_screen_name ||
			tweet.in_reply_to_status_id_str ||
			tweet.in_reply_to_user_id_str ||
			false;
		this.lang = tweet.lang || null;
		this.media = tweet.entities.media || [];
		this.numFavorites = tweet.favorite_count || 0;
		this.numRetweets = tweet.retweet_count;
		this.polls = tweet.entities.polls || [];
		this.text = tweet.full_text;
		this.quotedStatus = tweet.quoted_status
			? new Tweet(tweet.quoted_status)
			: null;
		this.quotedStatusId = tweet.quoted_status_id_str;
		this.retweetedStatusId = tweet.retweeted_status
			? tweet.retweeted_status.id_str
			: null;
		this.retweetedStatus = tweet.retweeted_status
			? new Tweet(tweet.retweeted_status)
			: null;
		this.tweetedAt = tweet.created_at;
		this.urls = tweet.entities.urls || [];
		this.user = new TwitterUser(tweet.user);
	}

	unnest() {
		return Object.assign({}, this, {
			user: undefined,
			retweetedStatus: undefined,
			quotedStatus: undefined,
		});
	}

	tweets() {
		const ret = [this.unnest()];
		if (this.quotedStatus) ret.push(...this.quotedStatus.tweets());
		if (this.retweetedStatus) ret.push(...this.retweetedStatus.tweets());
		return ret;
	}

	users() {
		const ret = [this.user];
		if (this.quotedStatus) ret.push(...this.quotedStatus.users());
		if (this.retweetedStatus) ret.push(...this.retweetedStatus.users());
		return ret;
	}

	ownerUpdateMutations() {
		const ret = [{ _id: this._id, userId: this.user._id }];
		if (this.quotedStatus)
			ret.push(...this.quotedStatus.ownerUpdateMutations());
		if (this.retweetedStatus)
			ret.push(...this.retweetedStatus.ownerUpdateMutations());
		return ret;
	}
}

export class TwitterUser {
	constructor(user) {
		this._id = user.id_str;
		this.createdAt = 1587020400000 - new Date(user.created_at).getTime(); // Time since account creation
		this.defaultProfile = !!user.default_profile;
		this.defaultProfileImage = !!user.default_profile_image;
		this.descriptionLength = user.description ? user.description.length : 0;
		this.isVerified = user.verified || false;
		this.location = user.location || null;
		this.name = user.name || '';
		this.numFavorites = user.favourites_count || 0; // Number of tweets this user has favorited
		this.numFollowers = user.followers_count || 0;
		this.numFriends = user.friends_count || 0;
		this.numListed = user.listed_count || 0;
		this.numStatuses = user.statuses_count || 0; // Number of tweets (including retweets) issued by the user
		this.protected = !!user.protected; // A user has protected their tweet
		this.screenName = user.screen_name || '';
		this.url = user.url || null;
	}
}
