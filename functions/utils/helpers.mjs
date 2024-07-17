import { CacheClient, Configurations, CredentialProvider } from '@gomomento/sdk';
import { Client, GatewayIntentBits } from 'discord.js';
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';

let cacheClient;

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
