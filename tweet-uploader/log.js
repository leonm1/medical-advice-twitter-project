const MONGO_DUPLICATE_ID_ERROR_CODE = 11000;

export function logRealErrors(err) {
	let realErrors = [];
	if (err && err.writeErrors) {
		realErrors = err.writeErrors.filter(
			(i) => i.err.code !== MONGO_DUPLICATE_ID_ERROR_CODE
		);
		if (realErrors.length) console.error(realErrors);
	}

	return {
		nErrors: realErrors.length,
		nDuplicates:
			(err.writeErrors ? err.writeErrors.length : 0) - realErrors.length,
		nInserted: err.result.nInserted,
		nUpdated: err.result.nUpdated,
	};
}

export async function* countDocuments(asyncIterable) {
	let numTweetsInserted = 0;
	let numUsersInserted = 0;
	let numErrors = 0;
	let numDuplicates = 0;

	for await (const result of asyncIterable) {
		result.forEach((update, index) => {
			const { nInserted = 0, nErrors = 0, nDuplicates = 0 } = update;
			if (index === 0) {
				numTweetsInserted += nInserted;
			} else {
				numUsersInserted += nInserted;
			}
			numErrors += nErrors;
			numDuplicates += nDuplicates;
		});
	}
	console.log(
		`Inserted ${numTweetsInserted} tweets and ${numUsersInserted} users, with ${numErrors} errors and ${numDuplicates} duplicates along the way.`
	);
}

export async function* countUpdates(asyncIterable) {
	let numModified = 0;
	let numErrors = 0;

	for await (const result of asyncIterable) {
		const { nModified = 0, nErrors = 0 } = result || {};
		numModified += nModified;
		numErrors += nErrors;
	}
	console.log(`Updated ${numModified} tweets, with ${numErrors} errors.`);
}
