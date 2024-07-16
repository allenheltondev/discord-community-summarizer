import { getDiscordClient, getMomentoClient } from "./utils/helpers.mjs";

let discord;

export const handler = async (state) => {
  try {
    discord = await getDiscordClient();

    const channel = await discord.channels.fetch(state.channel.id);
    let messages = [];
    let messageId;
    do {
      const messageBatch = await getChannelMessages(channel, messageId);
      if (messageBatch.length) {
        messages = [...messages, ...messageBatch];
        messageId = messageBatch[messageBatch.length - 1].id;
      } else {
        messageId = null;
      }
    } while (messageId);

    const filteredMessages = messages
      .filter(m => new Date(m.timestamp) > new Date(state.filterDate))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const output = getFormattedResponse(state.format, filteredMessages);
    const metadata = await getAnalytics(state.channel.name, filteredMessages);
    return { [state.format]: output, metadata };
  } catch (err) {
    console.error(err);
  } finally {
    await discord?.destroy();
  }
};

const getChannelMessages = async (channel, messageId) => {
  const messages = await channel.messages.fetch({
    limit: 100,
    ...messageId && { after: messageId }
  });
  const formattedMessages = messages.map(m => {
    return {
      user: {
        name: `${m.author.username}${m.author.globalName ? ` (${m.author.globalName})` : ''}`,
        id: m.author.id
      },
      message: m.content,
      timestamp: new Date(m.createdTimestamp).toISOString(),
      id: m.id
    };
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));;

  return formattedMessages;
};

const getFormattedResponse = (format, messages) => {
  switch (format.toLowerCase()) {
    case 'transcript':
      return messages.map(m => `${m.user.name}: ${m.message}`).join('\n');
    case 'raw':
    default:
      return messages;
  }
};

const getAnalytics = async (channel, messages) => {
  const cacheClient = await getMomentoClient();
  const users = [];
  for (const message of messages) {
    await cacheClient.sortedSetIncrementScore('bis', 'participants', message.user.name, 1);
    if (!users.includes(message.user.id)) {
      users.push(message.user.id);
    }
  }

  await cacheClient.sortedSetIncrementScore('bis', 'channels', channel, messages.length);
  return {
    messageCount: messages.length,
    distinctUsers: users.length
  };
};
