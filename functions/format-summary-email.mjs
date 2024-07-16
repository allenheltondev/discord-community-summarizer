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

    const html = createEmailHTML(topChannels, topTalkers, inactiveChannels, summaries, unansweredQuestions);
    return { html };
  } catch (err) {
    console.error(err);
    throw err;
  }
};

const getTopTalkers = async () => {
  let topTalkers = [];
  const partipiants = await cacheClient.sortedSetFetchByScore('bis', 'participants', { count: 8, order: 'DESC' });
  if (partipiants instanceof CacheSortedSetFetch.Hit) {
    topTalkers = partipiants.value();
  }

  return topTalkers;
};

const getTopChannels = async () => {
  let topChannels = [];
  const channels = await cacheClient.sortedSetFetchByScore('bis', 'channels', { order: 'DESC' });
  if (channels instanceof CacheSortedSetFetch.Hit) {
    topChannels = channels.value();
  }

  return topChannels;
};

const createEmailHTML = (topChannels, topTalkers, inactiveChannels, summaries, unansweredQuestions) => {
  const topChannelsTable = createTable('Top Channels', ['Channel Name', 'Message Count'], topChannels.map(tc => [tc.value, tc.score]));
  const topTalkersTable = createTable('Top Talkers', ['Name', 'Messages Sent'], topTalkers.map(tt => [tt.value, tt.score]));
  const inactiveChannelsTable = createTable('Inactive Channels', ['Channel Name'], inactiveChannels.map(ic => [ic]));
  const showUnansweredQuestions = unansweredQuestions.length > 0;

  return `
    <html>
    <body>
      <h1>Believe in Serverless Weekly Report</h1>
      <table class="table-container">
        <tr>
          <td valign="top" style="padding-right: 20px;">${topChannelsTable}</td>
          <td valign="top" style="padding-right: 20px;">${topTalkersTable}</td>
          <td valign="top">${inactiveChannelsTable}</td>
        </tr>
      </table>
      ${showUnansweredQuestions ? `
      <h2>Unanswered Questions</h2>
      <ul>
        ${unansweredQuestions.map(q => `<li><b>${q.channel}:</b> ${q.question}</li>`).join('')}
      </ul>
      ` : ''}
      <h2>Channel Summaries</h2>
      ${summaries.map(s => `<h3>${s.channel}</h3><ul>${s.summary.split('- ').filter(s => s).map(s => `<li>${s.trim()}</li>`).join('')}</ul>`).join('')}
      <p>That's it! Hope this helps</p>
      <p>Love,</p>
      <p>BIS Team</p>
    </body>
    </html>
  `;
};

const createTable = (title, headers, rows) => {
  const headerHtml = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const rowHtml = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `
    <h3>${title}</h3>
    <table border="1" cellpadding="5" cellspacing="0">
      <thead>
        ${headerHtml}
      </thead>
      <tbody>
        ${rowHtml}
      </tbody>
    </table>
  `;
};
