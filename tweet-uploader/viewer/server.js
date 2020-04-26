import express from 'express';
import path from 'path';
import mongodb from 'mongodb';
import fs from 'fs';

const app = express();

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

	let preload = fs.existsSync('db.json')
		? JSON.parse(fs.readFileSync('db.json', 'utf8'))
		: (async () => {
				console.info('Preload from file failed. Eagerly fetching from DB.');
				let ret = await tweetsCol
					.find({ lang: 'en', retweetedStatusId: null })
					.sort('numRetweets', -1)
					.limit(500)
					.toArray();

				fs.writeFileSync('db.json', JSON.stringify(ret));
				console.info('Preload saved to db.json');
				return ret;
		  })();

	app.get('/v1/tweets/:page', async (req, res) => {
		const { page } = req.params;

		if (preload) {
			res
				.status(200)
				.send(JSON.stringify(preload.slice(5 * page, 5 * page + 5)));
			return;
		}

		try {
			res.status(200).send(
				JSON.stringify(
					await tweetsCol
						.find({ lang: 'en', retweetedStatusId: null })
						.sort('numRetweets', -1)
						.limit(20)
						.skip(20 * Number(page))
						.toArray()
				)
			);
		} catch (err) {
			res.status(500).send(JSON.stringify(err));
			console.error(err);
		}
	});

	app.put('/v1/tweet/:status/quality/:quality', async (req, res) => {
		const { status, quality } = req.params;

		if (!['helpful', 'unhelpful', 'trash'].includes(quality))
			res.status(400).send(`${quality} is an invalid quality`);

		try {
			res.status(200).send(
				JSON.stringify(
					await tweetsCol.findOneAndUpdate(
						{
							_id: status,
							lang: 'en',
							retweetedStatusId: null,
						},
						{ $set: { quality } },
						{ returnOriginal: false }
					)
				)
			);
		} catch (err) {
			res.status(500).send(JSON.stringify(err));
			console.error(err);
		}
	});

	app.use(express.static('static'));

	app.listen(8080, () => {
		console.info('Serving on port 8080');
	});
})();
