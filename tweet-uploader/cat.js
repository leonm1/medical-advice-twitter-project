#!/usr/bin/env node

import { createGunzip, inflate } from 'zlib';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import yargs from 'yargs';
import { pipeline as callbackpipeline } from 'stream';
import { default as mongodb } from 'mongodb';
import { default as cj } from 'concatjson';

import { processTweets } from './tweets.js';
import { countDocuments, countUpdates, logRealErrors } from './log.js';

const UPLOAD_CHUNK_SIZE = 990;

const pipeline = promisify(callbackpipeline);

const tweetsUpdated = new Set();
const tweetsInserted = new Set();
const usersUpdated = new Set();
const usersInserted = new Set();

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
	const usersCol = db.collection('users');

	const uploadTweets = async function* (asyncTweets) {
		let tweetQueue = tweetsCol.initializeUnorderedBulkOp();
		let userQueue = usersCol.initializeUnorderedBulkOp();

		function flush() {
			const ret = Promise.all([
				tweetQueue.execute().catch(logRealErrors),
				userQueue.execute().catch(logRealErrors),
			]);
			tweetQueue = tweetsCol.initializeUnorderedBulkOp();

			userQueue = usersCol.initializeUnorderedBulkOp();
			return ret;
		}

		for await (const /** @type {Tweet} */ tweet of asyncTweets) {
			const users = tweet.users();
			const tweets = tweet.tweets();

			for (const update of tweets) {
				// Compute-efficient way to tell if tweetsUpdated contains _id
				let size = tweetsInserted.size;
				tweetsInserted.add(update._id);

				if (tweetsInserted.size !== size) tweetQueue.insert(update);
			}

			for (const update of users) {
				let size = usersInserted.size;
				usersInserted.add(update._id);

				if (usersInserted.size !== size) userQueue.insert(update);
			}

			if (
				tweetQueue.length > UPLOAD_CHUNK_SIZE ||
				userQueue.length > UPLOAD_CHUNK_SIZE
			) {
				yield flush();
			}
		}

		yield flush();
	};

	const updateTweetUserField = async function* (asyncTweets) {
		let uploadQueue = tweetsCol.initializeUnorderedBulkOp();
		for await (const /** @type {Tweet} */ tweet of asyncTweets) {
			const tweets = tweet.ownerUpdateMutations();

			for (const update of tweets) {
				// Compute-efficient way to tell if tweetsUpdated contains _id
				let size = tweetsUpdated.size;
				tweetsUpdated.add(update._id);

				if (tweetsUpdated.size !== size) {
					if (!update._id || !update.userId) {
						console.error(
							`Empty update: { _id: ${update._id}, userId: ${update.userId} }`
						);
						return;
					}
					uploadQueue
						.find({ _id: update._id })
						.updateOne({ $set: { userId: update.userId } });
				}
			}

			if (uploadQueue.length > UPLOAD_CHUNK_SIZE) {
				yield uploadQueue.execute().catch(logRealErrors);
				uploadQueue = tweetsCol.initializeUnorderedBulkOp();
			}
		}

		yield uploadQueue.execute().catch(logRealErrors);
	};

	for (const arg of yargs.argv._) {
		const inFn = `${arg}`;
		const inFile = createReadStream(inFn);

		const decompress = createGunzip();
		const parse = cj.parse();

		[inFile, decompress, parse].forEach((f) => f.on('error', console.error));

		// await pipeline(
		// 	inFile,
		// 	decompress,
		// 	parse,
		// 	processTweets,
		// 	uploadTweets,
		// 	countDocuments
		// ).catch(console.error);

		// await pipeline(
		// 	inFile,
		// 	decompress,
		// 	parse,
		// 	processTweets,
		// 	updateTweetUserField,
		// 	countUpdates
		// ).catch(console.error);

		inFile.close();
	}

	await client.close();
})();
