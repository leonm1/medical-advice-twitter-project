import { html } from 'https://unpkg.com/lit-html/lit-html.js';
import {
	component,
	useState,
	useEffect,
	useCallback,
} from 'https://unpkg.com/haunted/haunted.js';

const displayKeys = [
	['_id', 'Tweet ID'],
	['isQuoteStatus', 'Is a retweet'],
	['isReply', 'Is a reply'],
	['numFavorites', 'Number of favorites'],
	['numRetweets', 'Number of retweets'],
	['user', 'UserID'],
	['text', 'Text'],
	['hashtags', 'Hashtags', true],
	['media', 'Media', true],
	['urls', 'URLs', true],
];

const submit = async (id, quality) => {
	try {
		await fetch(`/v1/tweet/${id}/quality/${quality}`, { method: 'PUT' });
	} catch (err) {
		console.error(err);
	}
};

const toTweetView = (tweet) => html`<div class="card">
	<div>
		<button
			style="${tweet.quality === 'helpful' ? 'color:green' : ''}"
			@click="${() => submit(tweet._id, 'helpful')}"
		>
			Mark helpful
		</button>
		<button
			style="${tweet.quality === 'unhelpful' ? 'color:red' : ''}"
			@click="${() => submit(tweet._id, 'unhelpful')}"
		>
			Mark unhelpful
		</button>
		<button
			style="${tweet.quality === 'trash' ? 'color:purple' : ''}"
			@click="${() => submit(tweet._id, 'trash')}"
		>
			Mark trash
		</button>
	</div>
	<table>
		<thead>
			<tr>
				<th scope="col">Key</th>
				<th scope="col">Value</th>
			</tr>
		</thead>
		<tbody>
			${displayKeys.map(
				([key, title, json]) =>
					html`<tr>
						<th>${title}</th>
						<td>
							${json ? JSON.stringify(tweet[key], null, 2) : tweet[key]}
						</td>
					</tr>`
			)}
		</tbody>
	</table>
</div>`;

window.customElements.define(
	'tweet-viewer',
	component(() => {
		const [loading, setLoading] = useState(false);
		const [tweets, setTweets] = useState([]);
		const [offset, setOffset] = useState(0);

		const fetchResults = useCallback(async () => {
			setLoading(true);
			let result = await fetch(`/v1/tweets/${offset}`);
			if (result.ok) result = await result.json();

			setTweets(result);

			window.scrollTo(0, 0);

			setLoading(false);
		}, [setLoading, setTweets, offset]);

		const increment = () => setOffset(offset + 1) || fetchResults();
		const decrement = () => setOffset(offset - 1) || fetchResults();

		useEffect(() => {
			fetchResults();
		}, []);

		return html`
			<link rel="stylesheet" href="index.css" />
			<div>
				<input .value=${offset} />
				<button @click="${increment}">+</button>
				<button @click="${decrement}">-</button>
				<button @click="${increment}">
					${loading ? 'Loading...' : 'Next'}
				</button>
			</div>
			${tweets.map(toTweetView)}
			<button @click="${increment}">
				${loading ? 'Loading...' : 'Next'}
			</button>
		`;
	})
);

/*
Text content: <p>${...}</p>
Attribute: <p id="${...}"></p>
Boolean attribute: ?disabled="${...}"
Property: .value="${...}"
Event handler: @event="${...}"
*/
