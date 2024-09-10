import { CacheSortedSetFetch } from '@gomomento/sdk';
import { getMomentoClient } from "./utils/helpers.mjs";

let cacheClient;

export const handler = async (state) => {
  try {
    cacheClient = await getMomentoClient();
    const unansweredQuestions = [];
    const summaries = [];
    const inactiveChannels = [];
    for (const channel of state.channels) {
      const channelName = `#${channel.channel}`;
      if (channel.hasSummary) {
        for (const question of channel.questions) {
          unansweredQuestions.push({
            question,
            channel: channelName
          });
        }
        summaries.push({
          summary: channel.summary,
          channel: channelName
        });
      } else {
        inactiveChannels.push(channelName);
      }
    }

    const topTalkers = await getTopTalkers();
    const topChannels = await getTopChannels();

    const html = createEmailHTML(topChannels, topTalkers, inactiveChannels, summaries, unansweredQuestions, state.members, state.metadata);
    return { html };
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const getTopTalkers = async () => {
  let topTalkers = [];
  const participants = await cacheClient.sortedSetFetchByScore('bis', 'participants', { count: 8, order: 'DESC' });
  if (participants instanceof CacheSortedSetFetch.Hit) {
    topTalkers = participants.value();
  }

  return topTalkers;
};

const getTopChannels = async () => {
  let topChannels = [];
  const channels = await cacheClient.sortedSetFetchByScore('bis', 'channels', { order: 'DESC' });
  if (channels instanceof CacheSortedSetFetch.Hit) {
    topChannels = channels.value().filter(c => c.score > 1);
  }

  return topChannels;
};

const createEmailHTML = (topChannels, topTalkers, inactiveChannels, summaries, unansweredQuestions, members, metadata) => {
  const topChannelsTable = createTable('Top Channels', ['Channel Name', 'Message Count'], topChannels.map(tc => [tc.value, tc.score]));
  const topTalkersTable = createTable('Top Talkers', ['Name', 'Messages Sent'], topTalkers.map(tt => [tt.value, tt.score]));
  const inactiveChannelsTable = createTable('Inactive Channels', ['Channel Name'], inactiveChannels.map(ic => [ic]));
  const showUnansweredQuestions = unansweredQuestions.length > 0;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Believe in Serverless Community Report ${new Date(metadata.fromDate).toLocaleDateString()} - ${new Date(metadata.toDate).toLocaleDateString()}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script>
          tailwind.config = {
            theme: {
              extend: {
                colors: {
                  purple: '#250083',
                  darkBlue: '#a238FF',
                  lightBlue: '#AAE9FF',
                }
              }
            }
          }
        </script>
      </head>
      <body class="bg-gradient-to-br from-purple to-darkBlue text-white min-h-screen p-6">
        <div class="max-w-6xl mx-auto bg-white text-black p-6 rounded-lg shadow-lg">
          <h1 class="text-3xl font-bold mb-6">Believe in Serverless Community Report ${new Date(metadata.fromDate).toLocaleDateString()} - ${new Date(metadata.toDate).toLocaleDateString()}</h1>
          <table>
            <tr>
              <td valign="top" style="padding-right: 20px;">${topChannelsTable}</td>
              <td valign="top" style="padding-right: 20px;">${topTalkersTable}</td>
              <td valign="top">${inactiveChannelsTable}</td>
            </tr>
          </table>
          <h2 class="text-xl font-semibold mt-6 mb-4">Members</h2>
          <table class="w-full border border-gray-300 mb-8">
            <thead class="bg-lightBlue">
              <tr>
                <th class="border border-gray-300 p-2 text-left">Total members</th>
                <th class="border border-gray-300 p-2 text-left"># of members who left</th>
                <th class="border border-gray-300 p-2 text-left"># of new members</th>
                <th class="border border-gray-300 p-2 text-left">New members</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="border p-2">${members.memberCount}</td>
                <td class="border p-2">${members.lostMemberCount}</td>
                <td class="border p-2">${members.newMemberCount}</td>
                <td class="border p-2">${members.newMembers.map(m => m.name).join(', ')}</td>
              </tr>
            </tbody>
          </table>
          ${showUnansweredQuestions ? `
          <h2 class="text-xl font-semibold mt-6 mb-4">Unanswered Questions</h2>
          <ul class="list-disc ml-6 mb-8">
            ${unansweredQuestions.map(q => `<li><b>${q.channel}:</b> ${q.question}</li>`).join('')}
          </ul>
          ` : ''}
          <h2 class="text-xl font-semibold mt-6 mb-4">Channel Summaries</h2>
          ${summaries.map(s => `<h3 class="text-lg font-semibold mb-2">${s.channel}</h3><ul class="list-disc ml-6 mb-8">${s.summary.split('- ').filter(s => s).map(s => `<li>${s.trim()}</li>`).join('')}</ul>`).join('')}
          <p>That's it! Hope this helps.</p>
          <p>Love,</p>
          <p>The BIS Team</p>
        </div>
      </body>
    </html>
  `;
};

const createTable = (title, headers, rows) => {
  const headerHtml = `<tr>${headers.map(h => `<th class="border border-gray-300 p-2 text-black">${h}</th>`).join('')}</tr>`;
  const rowHtml = rows.map(r => `<tr>${r.map(c => `<td class="border p-2 text-black">${c}</td>`).join('')}</tr>`).join('');
  return `
    <h2 class="text-xl font-semibold mb-4">${title}</h2>
    <table class="w-full border border-gray-300 mb-8">
      <thead class="bg-lightBlue">
        ${headerHtml}
      </thead>
      <tbody>
        ${rowHtml}
      </tbody>
    </table>
  `;
};
