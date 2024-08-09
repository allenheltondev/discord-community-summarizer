import { getDiscordClient, getMomentoClient } from "./utils/helpers.mjs";

let discord;

export const handler = async (state) => {
  try {
    discord = await getDiscordClient();

    const channel = await discord.channels.fetch(state.channel.id);
    let messages = [];
    let lastMessageId = state.lastMessageId;
    let hasMoreMessages = false;
    do {
      const messageBatch = await getChannelMessages(channel, lastMessageId);
      if (messageBatch.length) {
        messages = [...messages, ...messageBatch];
        lastMessageId = messageBatch[messageBatch.length - 1].id;
        hasMoreMessages = true;
      } else {
        hasMoreMessages = false;
      }
    } while (hasMoreMessages);

    const filteredMessages = messages
      .filter(m => new Date(m.timestamp) > new Date(state.filterDate))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const threads = await getThreads(channel, filteredMessages);

    const output = getFormattedResponse(state.format, filteredMessages, threads);
    const metadata = await getAnalytics(state.channel.name, filteredMessages, threads);
    return { [state.format]: output, metadata, lastMessageId };
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
      id: m.id,
      hasThread: m.hasThread
    };
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));;

  return formattedMessages;
};

const getThreads = async (channel, channelMessages) => {
  const threads = [];
  const threadMessages = channelMessages.filter(m => m.hasThread);
  for (let index = 0; index < threadMessages.length; index++) {
    const threadMessage = threadMessages[index];
    const thread = await channel.threads.fetch(threadMessage.id);

    let messages = [];
    let messageId;
    do {
      const messageBatch = await getChannelMessages(thread, messageId);
      if (messageBatch.length) {
        messages = [...messages, ...messageBatch];
        messageId = messageBatch[messageBatch.length - 1].id;
      } else {
        messageId = null;
      }
    } while (messageId);
    threads.push({ name: `Thread ${index + 1}`, messages });
  }
  return threads;
};

const getFormattedResponse = (format, messages, threads) => {
  switch (format.toLowerCase()) {
    case 'transcript':
      let transcript = messages.map(m => `${m.user.name}: ${m.message}`).join('\n');
      threads.map(thread => {
        transcript += `\n\n ${thread.name}\n`;
        transcript += thread.messages.map(m => `${m.user.name}: ${m.message}`).join('\n');
      });
      return transcript;
    case 'raw':
    default:
      return messages;
  }
};

const getAnalytics = async (channel, messages, threads) => {
  const cacheClient = await getMomentoClient();
  const users = [];
  for (const message of messages) {
    await cacheClient.sortedSetIncrementScore('bis', 'participants', message.user.name, 1);
    if (!users.includes(message.user.id)) {
      users.push(message.user.id);
    }
  }

  for (const thread of threads) {
    for (const message of thread.messages) {
      await cacheClient.sortedSetIncrementScore('bis', 'participants', message.user.name, 1);
      if (!users.includes(message.user.id)) {
        users.push(message.user.id);
      }
    }
  }

  await cacheClient.sortedSetIncrementScore('bis', 'channels', channel, messages.length);
  return {
    messageCount: messages.length,
    distinctUsers: users.length
  };
};
