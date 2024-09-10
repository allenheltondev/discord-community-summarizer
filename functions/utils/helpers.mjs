import { AuthClient, CacheClient, Configurations, CredentialProvider, ExpiresIn, GenerateDisposableToken } from '@gomomento/sdk';
import { Client, GatewayIntentBits } from 'discord.js';
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';

let cacheClient;
let authClient;

export const getDiscordClient = async () => {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });
  const secrets = await getSecret(process.env.SECRET_ID, { transform: 'json' });
  await client.login(secrets.discord);

  return client;
};

export const getMomentoClient = async () => {
  if (!cacheClient) {
    const secrets = await getSecret(process.env.SECRET_ID, { transform: 'json' });
    cacheClient = new CacheClient({
      defaultTtlSeconds: 3600,
      credentialProvider: CredentialProvider.fromString(secrets.momento),
      configuration: Configurations.Lambda.latest()
    });
  }

  return cacheClient;
};

export const getMomentoToken = async (permissions) => {
  if (!authClient) {
    const secrets = await getSecret(process.env.SECRET_ID, { transform: 'json' });
    authClient = new AuthClient({
      credentialProvider: CredentialProvider.fromString(secrets.momento)
    });
  }

  const token = await authClient.generateDisposableToken({ permissions }, ExpiresIn.minutes(30));
  if (token instanceof GenerateDisposableToken.Success) {
    return token.authToken;
  }
};
