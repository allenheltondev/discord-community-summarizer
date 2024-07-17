# Discord Community Summarizer

This project is a serverless application that summarizes messages from the [Believe in Serverless Discord community](https://believeinserverless.com/community). It uses the Discord.js library to interact with the Discord API and retrieve messages from specified channels. The retrieved messages are then processed and summarized using natural language processing techniques.

## Workflow

* Retrieves messages from specified Discord channels
* Summarizes the messages using Anthropic Claude Sonnet
* Stores the summaries in Momento cache for efficient retrieval
* Sends an email to specified community champions

## Technologies used

* Node.js v20
* [Discord.js](https://discord.js.org/)
* AWS Lambda
* AWS Step Functions
* [Momento Cache](https://gomomento.com/platform/cache)

## Setup

* Clone the repository
* Install dependencies: `npm install`
* Build the project in the terminal `sam build`
* Set up Discord bot credentials and AWS Secrets Manager using the terminal command `sam deploy --guided`

## Usage

The application is triggered on a scheduled timer at 2am UTC on Mondays. It retrieves messages from the specified Discord channels, processes them, and stores the summaries in the Momento cache. The summaries can then be retrieved and displayed as needed.

It also identifies any unanswered questions in the community and updates member counts from the prior week for analytics.

## Momento Cache integration

This project uses Momento Cache as a distributed, serverless cache to store and retrieve counts across Lambda function invocations. It uses a sortedSet to automatically rank the top talkers and most frequently used channels.

The `helpers.mjs` file in the *utils* directory contains the code for initializing and interacting with the Momento Cache client. Here's how it works:

The `getMomentoClient` function creates a new instance of the `CacheClient` from the [*@gomomento/sdk*](https://www.npmjs.com/package/@gomomento/sdk) package. The `CacheClient` is configured with the following options:

* *defaultTtlSeconds*: The default time-to-live (TTL) for cache entries, set to 3600 seconds (1 hour) in this case.
* *credentialProvider*: The credential provider for authenticating with Momento Cache. In this case, it uses the `CredentialProvider.fromString` method to provide the credentials from an AWS Secrets Manager secret.
* *configuration*: The configuration for the Momento Cache client, set to `Configurations.Lambda.latest()` for use with AWS Lambda.

The `CacheClient` instance is cached and reused for subsequent requests to avoid creating a new client for each invocation.

To store a summary in the cache, you can use the `set` method of the `CacheClient` instance, like this:
```javascript
const cacheClient = await getMomentoClient();
await cacheClient.set('cacheName', 'key', 'value', { ttlSeconds: 3600 });
```

To increment a value on a sorted set for a thread-safe atomic counter, consider the following example where we increment the *fieldName* by 5:
```javascript
const cacheClient = await getMomentoClient();
await cacheClient.sortedSetIncrement('cacheName', 'sortedSetName', 'fieldName', 5);
```

## Email summaries

After analytics are calculated and summaries are generated, the workflow uses SendGrid for sending emails via the [serverless toolbox](https://github.com/readysetcloud/serverless-toolbox).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
