import { default as mongodb } from 'mongodb';
import yargs from 'yargs';
import ProgressBar from 'progress';

import { createWriteStream } from 'fs';

function randomSample(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

const MILLISECONDS_TO_DAYS = 1.1574074074074076e-8;

const args = yargs
	.option('seqLength', {
		alias: 'm',
		default: 40,
		describe: 'max sequence length',
	})
	.option('output', {
		alias: 'o',
		describe: 'output file path',
		default: 'out.json',
	}).argv;

const tweetFilter = Object.freeze({
	quality: { $in: ['helpful', 'unhelpful'] },
	retweetedStatusId: null,
	quotedStatusId: null,
	isQuoteStatus: false,
	isReply: false,
	lang: { $eq: 'en' },
});

const fieldsInTweet = Object.freeze({
	_id: true,
	userId: true,
	text: true,
	quality: true,
	tweetedAt: true,
});

function toRetweets(tweetsCol, bar) {
	return async function toRetweetsWithMongo({
		_id,
		userId,
		text,
		quality,
		tweetedAt,
	}) {
		try {
			const usersWhoveRetweeted /** @type {Array} */ = await tweetsCol
				.aggregate([
					{ $match: { retweetedStatusId: _id } },
					{
						$lookup: {
							from: 'users',
							localField: 'userId',
							foreignField: '_id',
							as: 'user',
						},
					},
					{ $unwind: '$user' },
					{ $sort: { tweetedAt: 1 } },
					{ $limit: args.seqLength },
					{
						$project: {
							_id: true,
							tweetedAt: true,
							user: {
								descriptionLength: true,
								screenNameLength: { $strLenCP: '$user.screenName' },
								numFollowers: true,
								numFriends: true,
								numStatuses: true,
								registrationAge: {
									$multiply: ['$user.createdAt', MILLISECONDS_TO_DAYS],
								},
								isVerified: true,
								defaultProfile: true,
							},
						},
					},
				])
				.toArray();

			// Extend vector to seqLength (for results with array length > 0)
			while (0 < usersWhoveRetweeted && usersWhoveRetweeted < args.seqLength) {
				usersWhoveRetweeted.push(randomSample(usersWhoveRetweeted));
			}

			usersWhoveRetweeted.sort(
				({ tweetedAt: a }, { tweetedAt: b }) =>
					// Sort into ascending order
					new Date(a).getTime() - new Date(b).getTime()
			);

			const userVector = usersWhoveRetweeted.map(({ user, tweetedAt }) => [
				[
					user.descriptionLength,
					user.screenNameLength,
					user.numFollowers,
					user.numFriends,
					user.numStatuses,
					user.registrationAge,
					user.isVerified ? 1 : 0,
					user.defaultProfile ? 1 : 0,
				],
				new Date(tweetedAt).getTime(),
			]);

			bar.tick();

			if (!userVector.length) return;

			return [
				userVector,
				text,
				quality === 'helpful' ? 0 : 1,
				userId,
				tweetedAt,
			];
		} catch (err) {
			console.error(err);
		}
	};
}

(async () => {
	const client = await mongodb.MongoClient.connect(
		'mongodb://localhost:27017',
		{
			useNewUrlParser: true,
			useUnifiedTopology: true,
		}
	);
	const db = client.db('tweets');
	const tweetsCol = db.collection('tweets');

	const outFile = createWriteStream(args.output);

	const tweets = await tweetsCol
		.find(tweetFilter, {
			projection: fieldsInTweet,
		})
		.toArray();

	outFile.on('error', console.error);

	console.log();
	const bar = new ProgressBar(
		'  Processing tweets: [:bar] :percent :current/:total',
		{
			complete: '#',
			incomplete: ' ',
			width: 40,
			total: tweets.length,
		}
	);

	for await (const tweet of tweets.map(toRetweets(tweetsCol, bar))) {
		if (tweet) outFile.write(`${JSON.stringify(tweet)}\n`);
	}

	outFile.close();
	client.close();
})();
